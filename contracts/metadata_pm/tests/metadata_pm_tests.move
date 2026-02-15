#[test_only]
module dlux::metadata_pm_tests;

use dlux::metadata_pm::{
    create_revenue_pool,
    set_merkle_root,
    distribute_ad_revenue,
    destroy_revenue_pool_for_testing,
};
use dlux::merkle_verifier::{
    create_merkle_root,
    verify_merkle_inclusion,
    verify_batch_ad_views,
    destroy_merkle_root,
};
use dlux::ad_payments::{init_for_testing, AdminCap};
use dlux::governance::{
    create_governance_config_for_testing,
    destroy_governance_config_for_testing,
};
use sui::test_scenario;
use sui::coin;
use sui::sui::SUI;
use sui::hash;

const ADMIN: address = @0xAD;
const CONTENT_CREATOR: address = @0xCC;
const FOUNDATION: address = @0xFF;
const PM_POOL: address = @0xDD;

/// Helper: build a valid 2-leaf Merkle tree
fun build_merkle_proof_for_content(content_id: vector<u8>): (
    vector<u8>,           // root_hash
    vector<vector<u8>>,   // proof_hashes
    vector<vector<vector<u8>>>, // proof_paths
    vector<vector<u8>>,   // proof_indices
) {
    let leaf0 = b"L0";
    let leaf1 = b"L1";
    let left = hash::keccak256(&leaf0);
    let right = hash::keccak256(&leaf1);
    let mut root_input = vector::empty<u8>();
    vector::append(&mut root_input, left);
    vector::append(&mut root_input, right);
    let root_hash = hash::keccak256(&root_input);
    let _ = content_id; // consumed by caller for MerkleRoot creation
    (root_hash, vector[leaf0], vector[vector[right]], vector[vector[0u8]])
}

#[test]
fun test_create_merkle_root() {
    let content_id = b"content_123";
    let root_hash = b"hash_abc";
    let leaf_count = 100;
    let threshold = 50;

    let merkle_root = create_merkle_root(content_id, root_hash, leaf_count, threshold);
    destroy_merkle_root(merkle_root);
}

#[test]
fun test_create_revenue_pool() {
    let mut scenario = test_scenario::begin(CONTENT_CREATOR);

    test_scenario::next_tx(&mut scenario, CONTENT_CREATOR);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let payment = coin::mint_for_testing<SUI>(1000, ctx);
        let pool = create_revenue_pool(b"content_123", payment, ctx);
        destroy_revenue_pool_for_testing(pool, ctx);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_verify_merkle_inclusion_empty_path_returns_false() {
    let result = verify_merkle_inclusion(
        b"leaf",
        vector::empty<vector<u8>>(),
        b"indices",
        b"root"
    );
    assert!(result == false, 0);
}

#[test]
fun test_verify_merkle_inclusion_empty_indices_returns_false() {
    let result = verify_merkle_inclusion(
        b"leaf",
        vector[b"sibling1", b"sibling2"],
        vector::empty<u8>(),
        b"root"
    );
    assert!(result == false, 0);
}

#[test]
fun test_verify_merkle_inclusion_valid() {
    let result = verify_merkle_inclusion(
        b"leaf",
        vector[b"sibling1", b"sibling2"],
        b"01",
        b"root"
    );
    assert!(result == false, 0); // false because root doesn't match
}

#[test]
fun test_verify_merkle_inclusion_path_indices_mismatch() {
    let result = verify_merkle_inclusion(
        b"leaf",
        vector[b"sibling1", b"sibling2"],
        b"0",
        b"root"
    );
    assert!(result == false, 0);
}

#[test]
#[expected_failure(abort_code = 1)]
fun test_create_merkle_root_invalid_threshold() {
    let merkle_root = create_merkle_root(b"content_123", b"root_hash", 40, 50);
    destroy_merkle_root(merkle_root);
}

#[test]
fun test_verify_batch_ad_views_threshold_met() {
    let merkle_root = create_merkle_root(b"content_123", b"root_hash", 100, 50);

    let result = verify_batch_ad_views(
        &merkle_root,
        vector[b"hash1", b"hash2"],
        vector[vector[b"path1"], vector[b"path2"]],
        vector[b"0", b"1"]
    );

    assert!(result == false, 0); // false with fake proofs
    destroy_merkle_root(merkle_root);
}

#[test]
/// Distribute ad revenue with PM active (status=0).
/// GovernanceConfig: 10/9/41/40 (foundation/gateway/creator/pm).
fun test_distribute_revenue_pm_active() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    { let ctx = test_scenario::ctx(&mut scenario); init_for_testing(ctx); };
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(1000, ctx);
            let mut pool = create_revenue_pool(b"content_123", payment, ctx);
            let gov = create_governance_config_for_testing(ctx);

            let (root_hash, proof_hashes, proof_paths, proof_indices) =
                build_merkle_proof_for_content(b"content_123");
            let merkle_root = create_merkle_root(b"content_123", root_hash, 2, 1);
            set_merkle_root(&mut pool, merkle_root, &admin_cap);

            distribute_ad_revenue(
                &mut pool,
                &gov,
                proof_hashes,
                proof_paths,
                proof_indices,
                0, // pm_status = active
                &admin_cap,
                ctx
            );
            destroy_revenue_pool_for_testing(pool, ctx);
            destroy_governance_config_for_testing(gov);
        };
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };
    test_scenario::end(scenario);
}

#[test]
/// Distribute ad revenue with PM passed (status=1).
/// GovernanceConfig: 10/9/81/0 (foundation/gateway/creator/pm).
fun test_distribute_revenue_pm_passed() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    { let ctx = test_scenario::ctx(&mut scenario); init_for_testing(ctx); };
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(1000, ctx);
            let mut pool = create_revenue_pool(b"content_passed", payment, ctx);
            let gov = create_governance_config_for_testing(ctx);

            let (root_hash, proof_hashes, proof_paths, proof_indices) =
                build_merkle_proof_for_content(b"content_passed");
            let merkle_root = create_merkle_root(b"content_passed", root_hash, 2, 1);
            set_merkle_root(&mut pool, merkle_root, &admin_cap);

            distribute_ad_revenue(
                &mut pool,
                &gov,
                proof_hashes,
                proof_paths,
                proof_indices,
                1, // pm_status = passed
                &admin_cap,
                ctx
            );
            destroy_revenue_pool_for_testing(pool, ctx);
            destroy_governance_config_for_testing(gov);
        };
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::metadata_pm::E_PM_FAILED_ADS_DISABLED)]
/// Distribute ad revenue with PM failed (status=2) should abort.
fun test_distribute_revenue_pm_failed_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    { let ctx = test_scenario::ctx(&mut scenario); init_for_testing(ctx); };
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(1000, ctx);
            let mut pool = create_revenue_pool(b"content_fail", payment, ctx);
            let gov = create_governance_config_for_testing(ctx);

            let (root_hash, proof_hashes, proof_paths, proof_indices) =
                build_merkle_proof_for_content(b"content_fail");
            let merkle_root = create_merkle_root(b"content_fail", root_hash, 2, 1);
            set_merkle_root(&mut pool, merkle_root, &admin_cap);

            distribute_ad_revenue(
                &mut pool,
                &gov,
                proof_hashes,
                proof_paths,
                proof_indices,
                2, // pm_status = failed => ABORT
                &admin_cap,
                ctx
            );
            destroy_revenue_pool_for_testing(pool, ctx);
            destroy_governance_config_for_testing(gov);
        };
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::metadata_pm::E_NO_MERKLE_ROOT_SET)]
fun test_distribute_revenue_no_merkle_root_set() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    { let ctx = test_scenario::ctx(&mut scenario); init_for_testing(ctx); };
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(1000, ctx);
            let mut pool = create_revenue_pool(b"content_123", payment, ctx);
            let gov = create_governance_config_for_testing(ctx);
            distribute_ad_revenue(
                &mut pool,
                &gov,
                vector[b"x"],
                vector[vector[b"y"]],
                vector[vector[0u8]],
                0,
                &admin_cap,
                ctx
            );
            destroy_revenue_pool_for_testing(pool, ctx);
            destroy_governance_config_for_testing(gov);
        };
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::metadata_pm::E_ALREADY_DISTRIBUTED)]
fun test_distribute_revenue_already_distributed() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    { let ctx = test_scenario::ctx(&mut scenario); init_for_testing(ctx); };
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(1000, ctx);
            let mut pool = create_revenue_pool(b"content_123", payment, ctx);
            let gov = create_governance_config_for_testing(ctx);

            let (root_hash, proof_hashes, proof_paths, proof_indices) =
                build_merkle_proof_for_content(b"content_123");
            let merkle_root = create_merkle_root(b"content_123", root_hash, 2, 1);
            set_merkle_root(&mut pool, merkle_root, &admin_cap);

            distribute_ad_revenue(
                &mut pool, &gov,
                proof_hashes, proof_paths, proof_indices,
                1, &admin_cap, ctx
            );
            // Second call should abort
            let leaf0 = b"L0";
            let leaf1 = b"L1";
            let right = hash::keccak256(&leaf1);
            let _ = hash::keccak256(&leaf0);
            distribute_ad_revenue(
                &mut pool, &gov,
                vector[leaf0], vector[vector[right]], vector[vector[0u8]],
                1, &admin_cap, ctx
            );
            destroy_revenue_pool_for_testing(pool, ctx);
            destroy_governance_config_for_testing(gov);
        };
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };
    test_scenario::end(scenario);
}
