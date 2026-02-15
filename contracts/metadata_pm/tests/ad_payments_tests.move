#[test_only]
module dlux::ad_payments_tests;

use dlux::ad_payments::{
    init_for_testing,
    create_escrow_for_testing,
    destroy_escrow_for_testing,
    create_revenue_pool_for_testing,
    destroy_revenue_pool_for_testing,
    create_creator_pm_escrow_for_testing,
    destroy_creator_pm_escrow_for_testing,
    get_creator_escrow_balance,
    is_creator_escrow_resolved,
    get_balance,
    get_advertiser,
    get_campaign_id,
    is_finalized,
    get_pool_balance,
    walrus_drawdown,
    resolve_escrow_success,
    resolve_escrow_failure,
};
use dlux::governance::{
    create_governance_config_for_walrus_testing,
    destroy_governance_config_for_testing,
};
use sui::test_scenario;
use sui::coin;
use sui::sui::SUI;
use sui::clock;
use sui::hash;

const ADMIN: address = @0xAD;
const ADVERTISER: address = @0xAA;
const WALRUS_PROVIDER: address = @0xDE;
const CREATOR: address = @0xBE;
const FOUNDATION: address = @0xEF;
const PM_POOL: address = @0xFA;

#[test]
fun test_init_creates_admin_cap_and_pool() {
    let mut scenario = test_scenario::begin(ADMIN);

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        init_for_testing(ctx);
    };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        assert!(test_scenario::has_most_recent_for_address<dlux::ad_payments::AdminCap>(ADMIN), 0);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_create_escrow() {
    let mut scenario = test_scenario::begin(ADVERTISER);

    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let campaign_id = object::id_from_address(@0xCA01);

        let escrow = create_escrow_for_testing(
            campaign_id,
            ADVERTISER,
            10000,
            3600000,
            ctx
        );

        assert!(get_advertiser(&escrow) == ADVERTISER, 0);
        assert!(get_campaign_id(&escrow) == campaign_id, 1);
        assert!(is_finalized(&escrow) == false, 2);
        assert!(get_balance(&escrow) == 0, 3);

        destroy_escrow_for_testing(escrow);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_escrow_not_finalized_initially() {
    let mut scenario = test_scenario::begin(ADVERTISER);

    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let campaign_id = object::id_from_address(@0xCA02);

        let escrow = create_escrow_for_testing(campaign_id, ADVERTISER, 5000, 0, ctx);
        assert!(is_finalized(&escrow) == false, 0);
        destroy_escrow_for_testing(escrow);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_escrow_get_campaign_id() {
    let mut scenario = test_scenario::begin(ADVERTISER);

    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let campaign_id = object::id_from_address(@0xCA03);

        let escrow = create_escrow_for_testing(campaign_id, ADVERTISER, 10000, 3600000, ctx);
        assert!(get_campaign_id(&escrow) == campaign_id, 0);
        destroy_escrow_for_testing(escrow);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_escrow_balance_starts_zero_in_test_helper() {
    let mut scenario = test_scenario::begin(ADVERTISER);

    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let campaign_id = object::id_from_address(@0xCA04);

        let escrow = create_escrow_for_testing(campaign_id, ADVERTISER, 50000, 7200000, ctx);
        assert!(get_balance(&escrow) == 0, 0);
        destroy_escrow_for_testing(escrow);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_escrow_advertiser_tracked() {
    let mut scenario = test_scenario::begin(ADVERTISER);

    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let campaign_id = object::id_from_address(@0xCA05);

        let escrow = create_escrow_for_testing(campaign_id, ADVERTISER, 25000, 0, ctx);
        assert!(get_advertiser(&escrow) == ADVERTISER, 0);
        destroy_escrow_for_testing(escrow);
    };

    test_scenario::end(scenario);
}

/// Helper: build a valid 2-leaf Merkle tree and return (root_hash, proof_hashes, proof_paths, proof_indices)
fun build_merkle_proof(): (vector<u8>, vector<vector<u8>>, vector<vector<vector<u8>>>, vector<vector<u8>>) {
    let leaf0 = b"L0";
    let leaf1 = b"L1";
    let left = hash::keccak256(&leaf0);
    let right = hash::keccak256(&leaf1);
    let mut root_input = vector::empty<u8>();
    vector::append(&mut root_input, left);
    vector::append(&mut root_input, right);
    let root_hash = hash::keccak256(&root_input);
    (root_hash, vector[leaf0], vector[vector[right]], vector[vector[0u8]])
}

#[test]
/// Walrus drawdown with PM active (status=0).
/// Splits: 10% foundation, 9% gateway, 41% creator escrow, 40% PM pool.
fun test_walrus_drawdown_pm_active() {
    let mut scenario = test_scenario::begin(ADMIN);

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        init_for_testing(ctx);
    };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<dlux::ad_payments::AdminCap>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let initial_coin = coin::mint_for_testing<SUI>(1_000_000_000_000, ctx); // 1000 SUI
        let mut pool = create_revenue_pool_for_testing(initial_coin, ctx);
        let gov = create_governance_config_for_walrus_testing(ctx);
        let mut creator_escrow = create_creator_pm_escrow_for_testing(b"dapp1", CREATOR, ctx);

        let (root_hash, proof_hashes, proof_paths, proof_indices) = build_merkle_proof();
        let drawdown_amount = 100_000_000_000u64; // 100 SUI

        walrus_drawdown(
            &mut pool,
            &gov,
            &mut creator_escrow,
            proof_hashes,
            proof_paths,
            proof_indices,
            b"content123",
            root_hash,
            2, 1,
            0, // pm_status = active
            PM_POOL, CREATOR, FOUNDATION, WALRUS_PROVIDER,
            drawdown_amount,
            &clock,
            &admin_cap,
            ctx
        );

        // Pool decreased by drawdown amount
        assert!(get_pool_balance(&pool) == 900_000_000_000, 0);

        // Creator escrow should have 41% of 100 SUI = 41 SUI
        assert!(get_creator_escrow_balance(&creator_escrow) == 41_000_000_000, 1);

        let mut roots = vector::empty<vector<u8>>();
        vector::push_back(&mut roots, root_hash);
        destroy_revenue_pool_for_testing(pool, roots, ctx);
        destroy_governance_config_for_testing(gov);
        destroy_creator_pm_escrow_for_testing(creator_escrow, ctx);
        clock::destroy_for_testing(clock);
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };

    test_scenario::end(scenario);
}

#[test]
/// Walrus drawdown with PM passed (status=1).
/// Splits: 10% foundation, 9% gateway, 81% creator, 0% PM pool.
fun test_walrus_drawdown_pm_passed() {
    let mut scenario = test_scenario::begin(ADMIN);

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        init_for_testing(ctx);
    };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<dlux::ad_payments::AdminCap>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let initial_coin = coin::mint_for_testing<SUI>(1_000_000_000_000, ctx);
        let mut pool = create_revenue_pool_for_testing(initial_coin, ctx);
        let gov = create_governance_config_for_walrus_testing(ctx);
        let mut creator_escrow = create_creator_pm_escrow_for_testing(b"dapp1", CREATOR, ctx);

        let (root_hash, proof_hashes, proof_paths, proof_indices) = build_merkle_proof();

        walrus_drawdown(
            &mut pool,
            &gov,
            &mut creator_escrow,
            proof_hashes,
            proof_paths,
            proof_indices,
            b"content456",
            root_hash,
            2, 1,
            1, // pm_status = passed
            PM_POOL, CREATOR, FOUNDATION, WALRUS_PROVIDER,
            100_000_000_000u64,
            &clock,
            &admin_cap,
            ctx
        );

        assert!(get_pool_balance(&pool) == 900_000_000_000, 0);
        // Creator escrow should be untouched (funds go directly to creator)
        assert!(get_creator_escrow_balance(&creator_escrow) == 0, 1);

        let mut roots = vector::empty<vector<u8>>();
        vector::push_back(&mut roots, root_hash);
        destroy_revenue_pool_for_testing(pool, roots, ctx);
        destroy_governance_config_for_testing(gov);
        destroy_creator_pm_escrow_for_testing(creator_escrow, ctx);
        clock::destroy_for_testing(clock);
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::ad_payments::E_PM_FAILED_ADS_DISABLED)]
/// Walrus drawdown with PM failed (status=2) should abort — ads disabled.
fun test_walrus_drawdown_pm_failed_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        init_for_testing(ctx);
    };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<dlux::ad_payments::AdminCap>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let initial_coin = coin::mint_for_testing<SUI>(1_000_000_000_000, ctx);
        let mut pool = create_revenue_pool_for_testing(initial_coin, ctx);
        let gov = create_governance_config_for_walrus_testing(ctx);
        let mut creator_escrow = create_creator_pm_escrow_for_testing(b"dapp1", CREATOR, ctx);

        let (_root_hash, proof_hashes, proof_paths, proof_indices) = build_merkle_proof();

        walrus_drawdown(
            &mut pool,
            &gov,
            &mut creator_escrow,
            proof_hashes,
            proof_paths,
            proof_indices,
            b"content789",
            b"root",
            2, 1,
            2, // pm_status = failed => ABORT
            PM_POOL, CREATOR, FOUNDATION, WALRUS_PROVIDER,
            100_000_000_000u64,
            &clock,
            &admin_cap,
            ctx
        );

        destroy_revenue_pool_for_testing(pool, vector::empty(), ctx);
        destroy_governance_config_for_testing(gov);
        destroy_creator_pm_escrow_for_testing(creator_escrow, ctx);
        clock::destroy_for_testing(clock);
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::ad_payments::E_INSUFFICIENT_FUNDS)]
fun test_walrus_drawdown_insufficient_funds() {
    let mut scenario = test_scenario::begin(ADMIN);

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        init_for_testing(ctx);
    };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<dlux::ad_payments::AdminCap>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let initial_coin = coin::mint_for_testing<SUI>(50_000_000_000, ctx); // 50 SUI
        let mut pool = create_revenue_pool_for_testing(initial_coin, ctx);
        let gov = create_governance_config_for_walrus_testing(ctx);
        let mut creator_escrow = create_creator_pm_escrow_for_testing(b"dapp1", CREATOR, ctx);

        let (root_hash, proof_hashes, proof_paths, proof_indices) = build_merkle_proof();

        walrus_drawdown(
            &mut pool,
            &gov,
            &mut creator_escrow,
            proof_hashes,
            proof_paths,
            proof_indices,
            b"content789",
            root_hash,
            2, 1,
            1,
            PM_POOL, CREATOR, FOUNDATION, WALRUS_PROVIDER,
            100_000_000_000u64, // 100 SUI > 50 SUI available
            &clock,
            &admin_cap,
            ctx
        );

        let mut roots = vector::empty<vector<u8>>();
        vector::push_back(&mut roots, root_hash);
        destroy_revenue_pool_for_testing(pool, roots, ctx);
        destroy_governance_config_for_testing(gov);
        destroy_creator_pm_escrow_for_testing(creator_escrow, ctx);
        clock::destroy_for_testing(clock);
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::ad_payments::E_BELOW_MIN_DRAWDOWN)]
fun test_walrus_drawdown_zero_amount() {
    let mut scenario = test_scenario::begin(ADMIN);

    test_scenario::next_tx(&mut scenario, ADMIN);
    { let ctx = test_scenario::ctx(&mut scenario); init_for_testing(ctx); };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<dlux::ad_payments::AdminCap>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let initial_coin = coin::mint_for_testing<SUI>(1_000_000_000_000, ctx);
        let mut pool = create_revenue_pool_for_testing(initial_coin, ctx);
        let gov = create_governance_config_for_walrus_testing(ctx);
        let mut creator_escrow = create_creator_pm_escrow_for_testing(b"dapp1", CREATOR, ctx);

        let (root_hash, proof_hashes, proof_paths, proof_indices) = build_merkle_proof();

        walrus_drawdown(
            &mut pool,
            &gov,
            &mut creator_escrow,
            proof_hashes,
            proof_paths,
            proof_indices,
            b"content999",
            root_hash,
            2, 1,
            1,
            PM_POOL, CREATOR, FOUNDATION, WALRUS_PROVIDER,
            0, // zero amount
            &clock,
            &admin_cap,
            ctx
        );

        destroy_revenue_pool_for_testing(pool, vector::empty(), ctx);
        destroy_governance_config_for_testing(gov);
        destroy_creator_pm_escrow_for_testing(creator_escrow, ctx);
        clock::destroy_for_testing(clock);
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::ad_payments::E_BUNDLE_OUT_OF_BOUNDS)]
fun test_walrus_drawdown_empty_proofs() {
    let mut scenario = test_scenario::begin(ADMIN);

    test_scenario::next_tx(&mut scenario, ADMIN);
    { let ctx = test_scenario::ctx(&mut scenario); init_for_testing(ctx); };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<dlux::ad_payments::AdminCap>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let initial_coin = coin::mint_for_testing<SUI>(1_000_000_000_000, ctx);
        let mut pool = create_revenue_pool_for_testing(initial_coin, ctx);
        let gov = create_governance_config_for_walrus_testing(ctx);
        let mut creator_escrow = create_creator_pm_escrow_for_testing(b"dapp1", CREATOR, ctx);

        walrus_drawdown(
            &mut pool,
            &gov,
            &mut creator_escrow,
            vector::empty<vector<u8>>(),
            vector::empty<vector<vector<u8>>>(),
            vector::empty<vector<u8>>(),
            b"content000",
            b"root",
            2, 1,
            1,
            PM_POOL, CREATOR, FOUNDATION, WALRUS_PROVIDER,
            100_000_000_000u64,
            &clock,
            &admin_cap,
            ctx
        );

        destroy_revenue_pool_for_testing(pool, vector::empty(), ctx);
        destroy_governance_config_for_testing(gov);
        destroy_creator_pm_escrow_for_testing(creator_escrow, ctx);
        clock::destroy_for_testing(clock);
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };

    test_scenario::end(scenario);
}

// ───── Creator PM Escrow Tests ─────

#[test]
/// Resolve escrow on PM success → creator gets funds.
fun test_resolve_escrow_success() {
    let mut scenario = test_scenario::begin(ADMIN);

    test_scenario::next_tx(&mut scenario, ADMIN);
    { let ctx = test_scenario::ctx(&mut scenario); init_for_testing(ctx); };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<dlux::ad_payments::AdminCap>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        // Create pool with funds, do a drawdown to fill the escrow
        let initial_coin = coin::mint_for_testing<SUI>(1_000_000_000_000, ctx);
        let mut pool = create_revenue_pool_for_testing(initial_coin, ctx);
        let gov = create_governance_config_for_walrus_testing(ctx);
        let mut creator_escrow = create_creator_pm_escrow_for_testing(b"dapp1", CREATOR, ctx);

        let (root_hash, proof_hashes, proof_paths, proof_indices) = build_merkle_proof();

        // Drawdown 100 SUI with PM active → creator_escrow gets 41 SUI
        walrus_drawdown(
            &mut pool, &gov, &mut creator_escrow,
            proof_hashes, proof_paths, proof_indices,
            b"content_esc", root_hash, 2, 1,
            0, PM_POOL, CREATOR, FOUNDATION, WALRUS_PROVIDER,
            100_000_000_000u64,
            &clock, &admin_cap, ctx
        );

        assert!(get_creator_escrow_balance(&creator_escrow) == 41_000_000_000, 0);
        assert!(!is_creator_escrow_resolved(&creator_escrow), 1);

        // Resolve as success → creator gets the 41 SUI
        resolve_escrow_success(&mut creator_escrow, &admin_cap, ctx);

        assert!(get_creator_escrow_balance(&creator_escrow) == 0, 2);
        assert!(is_creator_escrow_resolved(&creator_escrow), 3);

        let mut roots = vector::empty<vector<u8>>();
        vector::push_back(&mut roots, root_hash);
        destroy_revenue_pool_for_testing(pool, roots, ctx);
        destroy_governance_config_for_testing(gov);
        destroy_creator_pm_escrow_for_testing(creator_escrow, ctx);
        clock::destroy_for_testing(clock);
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };

    test_scenario::end(scenario);
}

#[test]
/// Resolve escrow on PM failure → PM pool gets forfeited funds.
fun test_resolve_escrow_failure() {
    let mut scenario = test_scenario::begin(ADMIN);

    test_scenario::next_tx(&mut scenario, ADMIN);
    { let ctx = test_scenario::ctx(&mut scenario); init_for_testing(ctx); };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<dlux::ad_payments::AdminCap>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let initial_coin = coin::mint_for_testing<SUI>(1_000_000_000_000, ctx);
        let mut pool = create_revenue_pool_for_testing(initial_coin, ctx);
        let gov = create_governance_config_for_walrus_testing(ctx);
        let mut creator_escrow = create_creator_pm_escrow_for_testing(b"dapp1", CREATOR, ctx);

        let (root_hash, proof_hashes, proof_paths, proof_indices) = build_merkle_proof();

        // Drawdown 100 SUI with PM active → creator_escrow gets 41 SUI
        walrus_drawdown(
            &mut pool, &gov, &mut creator_escrow,
            proof_hashes, proof_paths, proof_indices,
            b"content_fail", root_hash, 2, 1,
            0, PM_POOL, CREATOR, FOUNDATION, WALRUS_PROVIDER,
            100_000_000_000u64,
            &clock, &admin_cap, ctx
        );

        assert!(get_creator_escrow_balance(&creator_escrow) == 41_000_000_000, 0);

        // Resolve as failure → PM pool gets the 41 SUI
        resolve_escrow_failure(&mut creator_escrow, PM_POOL, &admin_cap, ctx);

        assert!(get_creator_escrow_balance(&creator_escrow) == 0, 1);
        assert!(is_creator_escrow_resolved(&creator_escrow), 2);

        let mut roots = vector::empty<vector<u8>>();
        vector::push_back(&mut roots, root_hash);
        destroy_revenue_pool_for_testing(pool, roots, ctx);
        destroy_governance_config_for_testing(gov);
        destroy_creator_pm_escrow_for_testing(creator_escrow, ctx);
        clock::destroy_for_testing(clock);
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::ad_payments::E_CREATOR_ESCROW_RESOLVED)]
/// Double-resolve should abort.
fun test_resolve_escrow_double_resolve_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);

    test_scenario::next_tx(&mut scenario, ADMIN);
    { let ctx = test_scenario::ctx(&mut scenario); init_for_testing(ctx); };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<dlux::ad_payments::AdminCap>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);

        let mut creator_escrow = create_creator_pm_escrow_for_testing(b"dapp1", CREATOR, ctx);

        resolve_escrow_success(&mut creator_escrow, &admin_cap, ctx);
        // Second resolve should abort
        resolve_escrow_success(&mut creator_escrow, &admin_cap, ctx);

        destroy_creator_pm_escrow_for_testing(creator_escrow, ctx);
        test_scenario::return_to_sender(&mut scenario, admin_cap);
    };

    test_scenario::end(scenario);
}
