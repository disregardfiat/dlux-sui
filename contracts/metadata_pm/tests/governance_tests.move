#[test_only]
module dlux::governance_tests;

use dlux::governance::{
    Self,
    create_governance_config_for_testing,
    destroy_governance_config_for_testing,
    create_governance_admin_cap_for_testing,
    destroy_governance_admin_cap_for_testing,
    destroy_governance_proposal_for_testing,
};
use sui::test_scenario;
use sui::clock;

const ADMIN: address = @0xAD;
const PROPOSER: address = @0xBB;

// ───── Reader defaults ─────

#[test]
fun test_governance_config_defaults() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let config = create_governance_config_for_testing(ctx);

        assert!(governance::get_pm_duration(&config) == 259_200_000, 0);       // 3 days
        assert!(governance::get_votable_fee(&config) == 1_000_000_000, 1);     // 1 SUI
        assert!(governance::get_pm_foundation_pct(&config) == 10, 2);
        assert!(governance::get_pm_gateway_pct(&config) == 9, 3);
        assert!(governance::get_pm_creator_pct(&config) == 41, 4);
        assert!(governance::get_pm_pool_pct(&config) == 40, 5);
        assert!(governance::get_post_foundation_pct(&config) == 10, 6);
        assert!(governance::get_post_gateway_pct(&config) == 9, 7);
        assert!(governance::get_post_creator_pct(&config) == 81, 8);
        assert!(governance::get_post_pm_pct(&config) == 0, 9);
        assert!(governance::get_proposal_duration(&config) == 604_800_000, 10); // 7 days
        assert!(governance::get_quorum_pct(&config) == 51, 11);

        destroy_governance_config_for_testing(config);
    };
    test_scenario::end(scenario);
}

// ───── PM status accessors ─────

#[test]
fun test_pm_status_accessors() {
    assert!(governance::pm_status_active() == 0, 0);
    assert!(governance::pm_status_passed() == 1, 1);
    assert!(governance::pm_status_failed() == 2, 2);
}

// ───── create_proposal ─────

#[test]
fun test_create_proposal_simple_param() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let config = create_governance_config_for_testing(ctx);
        let admin_cap = create_governance_admin_cap_for_testing(ctx);
        let clock = clock::create_for_testing(ctx);

        governance::create_proposal(
            &config,
            PROPOSER,
            b"pm_duration_ms",
            432_000_000, // 5 days
            vector::empty<u64>(),
            b"voters_root_placeholder",
            100,
            &clock,
            &admin_cap,
            ctx,
        );

        // Proposal was shared — we verify successful execution (no abort)
        destroy_governance_config_for_testing(config);
        destroy_governance_admin_cap_for_testing(admin_cap);
        clock::destroy_for_testing(clock);
    };
    test_scenario::end(scenario);
}

#[test]
fun test_create_proposal_splits() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let config = create_governance_config_for_testing(ctx);
        let admin_cap = create_governance_admin_cap_for_testing(ctx);
        let clock = clock::create_for_testing(ctx);

        governance::create_proposal(
            &config,
            PROPOSER,
            b"pm_splits",
            0, // ignored for splits
            vector[15u64, 10u64, 35u64, 40u64], // must sum to 100
            b"voters_root_placeholder",
            100,
            &clock,
            &admin_cap,
            ctx,
        );

        destroy_governance_config_for_testing(config);
        destroy_governance_admin_cap_for_testing(admin_cap);
        clock::destroy_for_testing(clock);
    };
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::governance::E_SPLITS_MUST_SUM_TO_100)]
fun test_create_proposal_splits_bad_sum() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let config = create_governance_config_for_testing(ctx);
        let admin_cap = create_governance_admin_cap_for_testing(ctx);
        let clock = clock::create_for_testing(ctx);

        governance::create_proposal(
            &config,
            PROPOSER,
            b"pm_splits",
            0,
            vector[10u64, 10u64, 10u64, 10u64], // sums to 40, not 100
            b"voters_root_placeholder",
            100,
            &clock,
            &admin_cap,
            ctx,
        );

        destroy_governance_config_for_testing(config);
        destroy_governance_admin_cap_for_testing(admin_cap);
        clock::destroy_for_testing(clock);
    };
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::governance::E_INVALID_SPLIT_COUNT)]
fun test_create_proposal_splits_wrong_count() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let config = create_governance_config_for_testing(ctx);
        let admin_cap = create_governance_admin_cap_for_testing(ctx);
        let clock = clock::create_for_testing(ctx);

        governance::create_proposal(
            &config,
            PROPOSER,
            b"post_splits",
            0,
            vector[50u64, 50u64], // needs exactly 4 elements
            b"voters_root_placeholder",
            100,
            &clock,
            &admin_cap,
            ctx,
        );

        destroy_governance_config_for_testing(config);
        destroy_governance_admin_cap_for_testing(admin_cap);
        clock::destroy_for_testing(clock);
    };
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::governance::E_INPUT_TOO_LONG)]
fun test_create_proposal_empty_key() {
    let mut scenario = test_scenario::begin(ADMIN);
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let config = create_governance_config_for_testing(ctx);
        let admin_cap = create_governance_admin_cap_for_testing(ctx);
        let clock = clock::create_for_testing(ctx);

        governance::create_proposal(
            &config,
            PROPOSER,
            b"", // empty param key
            42,
            vector::empty<u64>(),
            b"root",
            10,
            &clock,
            &admin_cap,
            ctx,
        );

        destroy_governance_config_for_testing(config);
        destroy_governance_admin_cap_for_testing(admin_cap);
        clock::destroy_for_testing(clock);
    };
    test_scenario::end(scenario);
}
