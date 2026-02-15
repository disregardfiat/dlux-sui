#[test_only]
module dlux::dapp_posting_tests;

use dlux::dapp_posting::{
    init_for_testing,
    create_posting_fee_pool_for_testing,
    create_posting_treasury_config_for_testing,
    create_dapp_registry_for_testing,
    return_registry_to_sender_for_testing,
    destroy_posting_fee_pool_for_testing,
    destroy_posting_treasury_config_for_testing,
    get_pool_balance,
    get_total_collected,
    post_dapp,
};
use dlux::governance::{
    create_governance_config_for_testing,
    destroy_governance_config_for_testing,
};
use dlux::prediction_market;
use sui::test_scenario;
use sui::coin;
use sui::sui::SUI;
use sui::clock;

const ADMIN: address = @0xAD;
const POSTER: address = @0xDE;
const PM_POOL: address = @0x0102;
const FOUNDATION: address = @0x0203;
const WALRUS_STORAGE_FUND: address = @0x0304;

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
        assert!(test_scenario::has_most_recent_for_address<dlux::dapp_posting::PostingAdminCap>(ADMIN), 0);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_post_dapp_with_fee() {
    let mut scenario = test_scenario::begin(POSTER);

    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        prediction_market::create_and_share_pm_registry_for_testing(ctx);
    };

    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let mut pm_registry = test_scenario::take_shared<prediction_market::PMRegistry>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let fee_coin = coin::mint_for_testing<SUI>(1_000_000_000, ctx);
        let mut pool = create_posting_fee_pool_for_testing(fee_coin, ctx);
        let mut registry = create_dapp_registry_for_testing(ctx);
        let posting_fee = coin::mint_for_testing<SUI>(2_000_000_000, ctx);
        let config = create_posting_treasury_config_for_testing(PM_POOL, FOUNDATION, WALRUS_STORAGE_FUND, ctx);
        let gov = create_governance_config_for_testing(ctx);

        post_dapp(
            &mut registry,
            &mut pool,
            &config,
            &gov,
            &mut pm_registry,
            b"My dApp",
            b"A test dApp",
            b"my-dapp",
            b"1.0.0",
            b"{\"entryPoint\":\"index.html\"}",
            vector[b"blob1", b"blob2"],
            vector[1024u64, 2048u64],
            vector[b"vr", b"360"],
            b"entertainment",
            posting_fee,
            &clock,
            ctx
        );

        assert!(get_pool_balance(&pool) == 1_000_000_000, 0);
        assert!(get_total_collected(&pool) == 1_000_000_000 + 2_000_000_000, 0);

        test_scenario::return_shared(pm_registry);
        return_registry_to_sender_for_testing(registry, ctx);
        destroy_posting_fee_pool_for_testing(pool, ctx);
        destroy_posting_treasury_config_for_testing(config);
        destroy_governance_config_for_testing(gov);
        clock::destroy_for_testing(clock);
    };

    test_scenario::end(scenario);
}

#[test]
/// Verify the posting fee split: 50% Foundation, 50% on-chain PM (creator YES position).
/// With 1 SUI fee and tiny blob sizes, storage cost is ~0, so remainder ≈ 1 SUI.
fun test_post_dapp_fee_split() {
    let mut scenario = test_scenario::begin(POSTER);

    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        prediction_market::create_and_share_pm_registry_for_testing(ctx);
    };

    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let mut pm_registry = test_scenario::take_shared<prediction_market::PMRegistry>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let zero_coin = coin::mint_for_testing<SUI>(0, ctx);
        let mut pool = create_posting_fee_pool_for_testing(zero_coin, ctx);
        let mut registry = create_dapp_registry_for_testing(ctx);
        let posting_fee = coin::mint_for_testing<SUI>(2_000_000_000, ctx);
        let config = create_posting_treasury_config_for_testing(PM_POOL, FOUNDATION, WALRUS_STORAGE_FUND, ctx);
        let gov = create_governance_config_for_testing(ctx);

        post_dapp(
            &mut registry,
            &mut pool,
            &config,
            &gov,
            &mut pm_registry,
            b"SplitTest",
            b"desc",
            b"split-test",
            b"1.0.0",
            b"{}",
            vector[b"blob1"],
            vector[100u64],
            vector[],
            b"cat",
            posting_fee,
            &clock,
            ctx
        );

        assert!(get_pool_balance(&pool) == 0, 0);
        assert!(get_total_collected(&pool) == 2_000_000_000, 0);

        test_scenario::return_shared(pm_registry);
        return_registry_to_sender_for_testing(registry, ctx);
        destroy_posting_fee_pool_for_testing(pool, ctx);
        destroy_posting_treasury_config_for_testing(config);
        destroy_governance_config_for_testing(gov);
        clock::destroy_for_testing(clock);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::dapp_posting::E_INVALID_NAME)]
fun test_post_dapp_empty_name() {
    let mut scenario = test_scenario::begin(POSTER);

    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        prediction_market::create_and_share_pm_registry_for_testing(ctx);
    };
    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let mut pm_registry = test_scenario::take_shared<prediction_market::PMRegistry>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let fee_coin = coin::mint_for_testing<SUI>(1000000000, ctx);
        let mut pool = create_posting_fee_pool_for_testing(fee_coin, ctx);
        let mut registry = create_dapp_registry_for_testing(ctx);
        let posting_fee = coin::mint_for_testing<SUI>(10000000, ctx);
        let config = create_posting_treasury_config_for_testing(PM_POOL, FOUNDATION, WALRUS_STORAGE_FUND, ctx);
        let gov = create_governance_config_for_testing(ctx);
        post_dapp(
            &mut registry,
            &mut pool,
            &config,
            &gov,
            &mut pm_registry,
            b"",
            b"Description",
            b"permlink",
            b"1.0.0",
            b"{}",
            vector[b"x"],
            vector[1024u64],
            vector[],
            b"category",
            posting_fee,
            &clock,
            ctx
        );
        test_scenario::return_shared(pm_registry);
        return_registry_to_sender_for_testing(registry, ctx);
        destroy_posting_fee_pool_for_testing(pool, ctx);
        destroy_posting_treasury_config_for_testing(config);
        destroy_governance_config_for_testing(gov);
        clock::destroy_for_testing(clock);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::dapp_posting::E_INVALID_PERMLINK)]
fun test_post_dapp_empty_permlink() {
    let mut scenario = test_scenario::begin(POSTER);

    test_scenario::next_tx(&mut scenario, POSTER);
    { let ctx = test_scenario::ctx(&mut scenario); prediction_market::create_and_share_pm_registry_for_testing(ctx); };
    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let mut pm_registry = test_scenario::take_shared<prediction_market::PMRegistry>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let fee_coin = coin::mint_for_testing<SUI>(1000000000, ctx);
        let mut pool = create_posting_fee_pool_for_testing(fee_coin, ctx);
        let mut registry = create_dapp_registry_for_testing(ctx);
        let posting_fee = coin::mint_for_testing<SUI>(10000000, ctx);
        let config = create_posting_treasury_config_for_testing(PM_POOL, FOUNDATION, WALRUS_STORAGE_FUND, ctx);
        let gov = create_governance_config_for_testing(ctx);
        post_dapp(
            &mut registry,
            &mut pool,
            &config,
            &gov,
            &mut pm_registry,
            b"Name",
            b"Description",
            b"",
            b"1.0.0",
            b"{}",
            vector[b"x"],
            vector[1024u64],
            vector[],
            b"category",
            posting_fee,
            &clock,
            ctx
        );
        test_scenario::return_shared(pm_registry);
        return_registry_to_sender_for_testing(registry, ctx);
        destroy_posting_fee_pool_for_testing(pool, ctx);
        destroy_posting_treasury_config_for_testing(config);
        destroy_governance_config_for_testing(gov);
        clock::destroy_for_testing(clock);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::dapp_posting::E_BLOB_IDS_EMPTY)]
fun test_post_dapp_empty_blob_ids() {
    let mut scenario = test_scenario::begin(POSTER);

    test_scenario::next_tx(&mut scenario, POSTER);
    { let ctx = test_scenario::ctx(&mut scenario); prediction_market::create_and_share_pm_registry_for_testing(ctx); };
    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let mut pm_registry = test_scenario::take_shared<prediction_market::PMRegistry>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let fee_coin = coin::mint_for_testing<SUI>(1000000000, ctx);
        let mut pool = create_posting_fee_pool_for_testing(fee_coin, ctx);
        let mut registry = create_dapp_registry_for_testing(ctx);
        let posting_fee = coin::mint_for_testing<SUI>(10000000, ctx);
        let config = create_posting_treasury_config_for_testing(PM_POOL, FOUNDATION, WALRUS_STORAGE_FUND, ctx);
        let gov = create_governance_config_for_testing(ctx);
        post_dapp(
            &mut registry,
            &mut pool,
            &config,
            &gov,
            &mut pm_registry,
            b"Name",
            b"Description",
            b"permlink",
            b"1.0.0",
            b"{}",
            vector[],
            vector[],
            vector[],
            b"category",
            posting_fee,
            &clock,
            ctx
        );
        test_scenario::return_shared(pm_registry);
        return_registry_to_sender_for_testing(registry, ctx);
        destroy_posting_fee_pool_for_testing(pool, ctx);
        destroy_posting_treasury_config_for_testing(config);
        destroy_governance_config_for_testing(gov);
        clock::destroy_for_testing(clock);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::dapp_posting::E_INSUFFICIENT_FEE)]
fun test_post_dapp_insufficient_fee() {
    let mut scenario = test_scenario::begin(POSTER);

    test_scenario::next_tx(&mut scenario, POSTER);
    { let ctx = test_scenario::ctx(&mut scenario); prediction_market::create_and_share_pm_registry_for_testing(ctx); };
    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let mut pm_registry = test_scenario::take_shared<prediction_market::PMRegistry>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let fee_coin = coin::mint_for_testing<SUI>(1000000000, ctx);
        let mut pool = create_posting_fee_pool_for_testing(fee_coin, ctx);
        let mut registry = create_dapp_registry_for_testing(ctx);
        let posting_fee = coin::mint_for_testing<SUI>(100000, ctx);
        let config = create_posting_treasury_config_for_testing(PM_POOL, FOUNDATION, WALRUS_STORAGE_FUND, ctx);
        let gov = create_governance_config_for_testing(ctx);
        post_dapp(
            &mut registry,
            &mut pool,
            &config,
            &gov,
            &mut pm_registry,
            b"Name",
            b"Description",
            b"permlink",
            b"1.0.0",
            b"{}",
            vector[b"blob001"],
            vector[2048u64],
            vector[],
            b"category",
            posting_fee,
            &clock,
            ctx
        );
        test_scenario::return_shared(pm_registry);
        return_registry_to_sender_for_testing(registry, ctx);
        destroy_posting_fee_pool_for_testing(pool, ctx);
        destroy_posting_treasury_config_for_testing(config);
        destroy_governance_config_for_testing(gov);
        clock::destroy_for_testing(clock);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::dapp_posting::E_INPUT_TOO_LONG)]
fun test_post_dapp_name_too_long() {
    let mut scenario = test_scenario::begin(POSTER);

    test_scenario::next_tx(&mut scenario, POSTER);
    { let ctx = test_scenario::ctx(&mut scenario); prediction_market::create_and_share_pm_registry_for_testing(ctx); };
    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let mut pm_registry = test_scenario::take_shared<prediction_market::PMRegistry>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);

        let fee_coin = coin::mint_for_testing<SUI>(1000000000, ctx);
        let mut pool = create_posting_fee_pool_for_testing(fee_coin, ctx);
        let mut registry = create_dapp_registry_for_testing(ctx);
        let posting_fee = coin::mint_for_testing<SUI>(10000000, ctx);
        let config = create_posting_treasury_config_for_testing(PM_POOL, FOUNDATION, WALRUS_STORAGE_FUND, ctx);
        let gov = create_governance_config_for_testing(ctx);
        let mut long_name = vector::empty<u8>();
        let mut i = 0u64;
        while (i < 2049) {
            vector::push_back(&mut long_name, 97);
            i = i + 1;
        };
        post_dapp(
            &mut registry,
            &mut pool,
            &config,
            &gov,
            &mut pm_registry,
            long_name,
            b"Description",
            b"permlink",
            b"1.0.0",
            b"{}",
            vector[b"blob1"],
            vector[1024u64],
            vector[],
            b"category",
            posting_fee,
            &clock,
            ctx
        );
        test_scenario::return_shared(pm_registry);
        return_registry_to_sender_for_testing(registry, ctx);
        destroy_posting_fee_pool_for_testing(pool, ctx);
        destroy_posting_treasury_config_for_testing(config);
        destroy_governance_config_for_testing(gov);
        clock::destroy_for_testing(clock);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::dapp_posting::E_DUPLICATE_PERMLINK)]
fun test_post_dapp_duplicate_permlink() {
    let mut scenario = test_scenario::begin(POSTER);
    test_scenario::next_tx(&mut scenario, POSTER);
    { let ctx = test_scenario::ctx(&mut scenario); prediction_market::create_and_share_pm_registry_for_testing(ctx); };
    test_scenario::next_tx(&mut scenario, POSTER);
    {
        let mut pm_registry = test_scenario::take_shared<prediction_market::PMRegistry>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);
        let fee_coin = coin::mint_for_testing<SUI>(1_000_000_000, ctx);
        let mut pool = create_posting_fee_pool_for_testing(fee_coin, ctx);
        let mut registry = create_dapp_registry_for_testing(ctx);
        let posting_fee = coin::mint_for_testing<SUI>(2_000_000_000, ctx);
        let config = create_posting_treasury_config_for_testing(PM_POOL, FOUNDATION, WALRUS_STORAGE_FUND, ctx);
        let gov = create_governance_config_for_testing(ctx);
        post_dapp(
            &mut registry,
            &mut pool,
            &config,
            &gov,
            &mut pm_registry,
            b"First",
            b"Desc",
            b"same-slug",
            b"1.0.0",
            b"{}",
            vector[b"blob1"],
            vector[1024u64],
            vector[],
            b"cat",
            posting_fee,
            &clock,
            ctx
        );
        let posting_fee2 = coin::mint_for_testing<SUI>(2_000_000_000, ctx);
        post_dapp(
            &mut registry,
            &mut pool,
            &config,
            &gov,
            &mut pm_registry,
            b"Second",
            b"Desc2",
            b"same-slug",
            b"1.0.0",
            b"{}",
            vector[b"blob2"],
            vector[2048u64],
            vector[],
            b"cat",
            posting_fee2,
            &clock,
            ctx
        );
        test_scenario::return_shared(pm_registry);
        return_registry_to_sender_for_testing(registry, ctx);
        destroy_posting_fee_pool_for_testing(pool, ctx);
        destroy_posting_treasury_config_for_testing(config);
        destroy_governance_config_for_testing(gov);
        clock::destroy_for_testing(clock);
    };
    test_scenario::end(scenario);
}
