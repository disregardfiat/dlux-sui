#[test_only]
module dlux::ad_campaigns_tests;

use dlux::ad_campaigns::{
    create_campaign_for_testing,
    destroy_for_testing,
    get_status,
    get_remaining_budget,
    get_bid,
    get_advertiser,
    get_impression_count,
    is_active_with_budget,
    is_owner_paused,
    deduct_impression_cost,
    pause_campaign,
    resume_campaign,
    pause_by_owner,
    resume_from_owner_pause,
    cancel_campaign,
    update_campaign,
};
use sui::test_scenario;
use sui::clock;

const ADVERTISER: address = @0xAD;
const OTHER_USER: address = @0x0B;

// Status constants from the module
const STATUS_ACTIVE: u8 = 0;
const STATUS_PAUSED: u8 = 1;
const STATUS_CANCELLED: u8 = 2;
const STATUS_EXPIRED: u8 = 3;
const STATUS_BUDGET_DEPLETED: u8 = 4;
const STATUS_PAUSED_BY_OWNER: u8 = 5;

#[test]
fun test_create_campaign() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,    // bid: 100 MIST per impression
            10000,  // budget: 10000 MIST
            1000,   // start_at
            2000,   // end_at
            ctx
        );
        
        assert!(get_status(&campaign) == STATUS_ACTIVE, 0);
        assert!(get_remaining_budget(&campaign) == 10000, 1);
        assert!(get_bid(&campaign) == 100, 2);
        assert!(get_advertiser(&campaign) == ADVERTISER, 3);
        assert!(get_impression_count(&campaign) == 0, 4);
        
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_is_active_with_budget() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,  // start_at
            2000,  // end_at
            ctx
        );
        
        // Test before start - clock at 500
        let mut clock_before = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_before, 500);
        assert!(is_active_with_budget(&campaign, &clock_before) == false, 1);
        clock::destroy_for_testing(clock_before);
        
        // Test within campaign period - clock at 1500
        let mut clock_active = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_active, 1500);
        assert!(is_active_with_budget(&campaign, &clock_active) == true, 0);
        clock::destroy_for_testing(clock_active);
        
        // Test after end - clock at 2500
        let mut clock_after = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_after, 2500);
        assert!(is_active_with_budget(&campaign, &clock_after) == false, 2);
        clock::destroy_for_testing(clock_after);
        
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_deduct_impression_cost() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,    // bid
            1000,   // budget (enough for 10 impressions)
            1000,   // start_at
            2000,   // end_at
            ctx
        );
        
        let mut clock_obj = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_obj, 1500);
        
        // Deduct first impression
        let success = deduct_impression_cost(&mut campaign, &clock_obj);
        assert!(success == true, 0);
        assert!(get_remaining_budget(&campaign) == 900, 1);
        assert!(get_impression_count(&campaign) == 1, 2);
        
        // Deduct more impressions
        let _ = deduct_impression_cost(&mut campaign, &clock_obj);
        let _ = deduct_impression_cost(&mut campaign, &clock_obj);
        
        assert!(get_remaining_budget(&campaign) == 700, 3);
        assert!(get_impression_count(&campaign) == 3, 4);
        
        clock::destroy_for_testing(clock_obj);
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_deduct_impression_cost_depletes_budget() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,    // bid
            200,    // budget (enough for 2 impressions)
            1000,
            2000,
            ctx
        );
        
        let mut clock_obj = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_obj, 1500);
        
        // First impression
        let _ = deduct_impression_cost(&mut campaign, &clock_obj);
        assert!(get_status(&campaign) == STATUS_ACTIVE, 0);
        
        // Second impression - should deplete budget
        let _ = deduct_impression_cost(&mut campaign, &clock_obj);
        assert!(get_status(&campaign) == STATUS_BUDGET_DEPLETED, 1);
        assert!(get_remaining_budget(&campaign) == 0, 2);
        
        // Third attempt should fail
        let success = deduct_impression_cost(&mut campaign, &clock_obj);
        assert!(success == false, 3);
        
        clock::destroy_for_testing(clock_obj);
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_deduct_impression_cost_expired() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,
            2000,
            ctx
        );
        
        // Clock after campaign end
        let mut clock_obj = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_obj, 2500);
        
        let success = deduct_impression_cost(&mut campaign, &clock_obj);
        assert!(success == false, 0);
        assert!(get_status(&campaign) == STATUS_EXPIRED, 1);
        
        clock::destroy_for_testing(clock_obj);
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_pause_and_resume_campaign() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,
            2000,
            ctx
        );
        
        // Pause
        pause_campaign(&mut campaign, ctx);
        assert!(get_status(&campaign) == STATUS_PAUSED, 0);
        
        // Resume
        let mut clock_obj = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_obj, 1500);
        
        let ctx2 = test_scenario::ctx(&mut scenario);
        resume_campaign(&mut campaign, &clock_obj, ctx2);
        assert!(get_status(&campaign) == STATUS_ACTIVE, 1);
        
        clock::destroy_for_testing(clock_obj);
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_cancel_campaign() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,
            2000,
            ctx
        );
        
        cancel_campaign(&mut campaign, ctx);
        assert!(get_status(&campaign) == STATUS_CANCELLED, 0);
        assert!(get_remaining_budget(&campaign) == 0, 1);
        
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_update_campaign() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,
            2000,
            ctx
        );
        // Cooldown: update_campaign requires last_metadata_update_ts + 7 days <= now
        let mut clock_obj = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_obj, 1000 + 7 * 24 * 60 * 60 * 1000); // 7 days after start
        update_campaign(
            &mut campaign,
            b"Updated Title",
            b"Updated Description",
            b"https://updated.com",
            &clock_obj,
            ctx
        );
        clock::destroy_for_testing(clock_obj);
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::ad_campaigns::E_CAMPAIGN_CANCELLED)]
fun test_update_cancelled_campaign_fails() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,
            2000,
            ctx
        );
        
        // Cancel first
        cancel_campaign(&mut campaign, ctx);
        
        // Try to update - should fail (campaign cancelled)
        let ctx2 = test_scenario::ctx(&mut scenario);
        let clock_obj = clock::create_for_testing(ctx2);
        update_campaign(
            &mut campaign,
            b"Updated Title",
            b"Updated Description",
            b"https://updated.com",
            &clock_obj,
            ctx2
        );
        clock::destroy_for_testing(clock_obj);
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::ad_campaigns::E_NOT_ADVERTISER)]
fun test_update_by_non_advertiser_fails() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,
            2000,
            ctx
        );
        
        // Try to update as different user - should fail
        test_scenario::next_tx(&mut scenario, OTHER_USER);
        let ctx2 = test_scenario::ctx(&mut scenario);
        let clock_obj = clock::create_for_testing(ctx2);
        update_campaign(
            &mut campaign,
            b"Hacked Title",
            b"Hacked Description",
            b"https://hacked.com",
            &clock_obj,
            ctx2
        );
        clock::destroy_for_testing(clock_obj);
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::ad_campaigns::E_NOT_ADVERTISER)]
fun test_pause_by_non_advertiser_fails() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,
            2000,
            ctx
        );
        
        // Try to pause as different user - should fail
        test_scenario::next_tx(&mut scenario, OTHER_USER);
        let ctx2 = test_scenario::ctx(&mut scenario);
        pause_campaign(&mut campaign, ctx2);
        
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::ad_campaigns::E_NOT_ADVERTISER)]
fun test_cancel_by_non_advertiser_fails() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,
            2000,
            ctx
        );
        
        // Try to cancel as different user - should fail
        test_scenario::next_tx(&mut scenario, OTHER_USER);
        let ctx2 = test_scenario::ctx(&mut scenario);
        cancel_campaign(&mut campaign, ctx2);
        
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_pause_by_owner_and_resume() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,
            2000,
            ctx
        );
        let mut clock_obj = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_obj, 1500);
        
        assert!(get_status(&campaign) == STATUS_ACTIVE, 0);
        pause_by_owner(&mut campaign, &clock_obj, ctx);
        assert!(get_status(&campaign) == STATUS_PAUSED_BY_OWNER, 1);
        assert!(is_owner_paused(&campaign), 2);
        assert!(is_active_with_budget(&campaign, &clock_obj) == false, 3);
        
        resume_from_owner_pause(&mut campaign, &clock_obj, ctx);
        assert!(get_status(&campaign) == STATUS_ACTIVE, 4);
        assert!(is_owner_paused(&campaign) == false, 5);
        
        clock::destroy_for_testing(clock_obj);
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = dlux::ad_campaigns::E_CAMPAIGN_PAUSED_BY_OWNER)]
fun test_deduct_impression_cost_when_owner_paused_fails() {
    let mut scenario = test_scenario::begin(ADVERTISER);
    
    test_scenario::next_tx(&mut scenario, ADVERTISER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let mut campaign = create_campaign_for_testing(
            ADVERTISER,
            b"Test Campaign",
            100,
            10000,
            1000,
            2000,
            ctx
        );
        let mut clock_obj = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_obj, 1500);
        pause_by_owner(&mut campaign, &clock_obj, ctx);
        deduct_impression_cost(&mut campaign, &clock_obj);
        clock::destroy_for_testing(clock_obj);
        destroy_for_testing(campaign);
    };
    
    test_scenario::end(scenario);
}
