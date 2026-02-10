#[test_only]
module dlux::ad_tracking_tests;

use dlux::ad_tracking::{
    create_token_for_testing,
    destroy_token_for_testing,
    get_token_hash,
    get_token_ad_id,
    is_token_expired,
    is_token_used,
    init_for_testing,
    ClickTokenRegistry,
    verify_click_token,
    get_registry_stats,
    create_click_token,
    has_conversion,
};
use dlux::ad_tracking::ClickToken;
use sui::test_scenario;
use sui::clock;

const USER: address = @0xAA;
const ADMIN: address = @0xAD;

#[test]
fun test_create_click_token() {
    let mut scenario = test_scenario::begin(USER);
    
    test_scenario::next_tx(&mut scenario, USER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let ad_id = object::id_from_address(@0xAD01);
        
        let token = create_token_for_testing(
            ad_id,
            b"content_123",
            b"token_hash_abc",
            1000,   // created_at
            2000,   // expires_at
            ctx
        );
        
        assert!(get_token_ad_id(&token) == ad_id, 0);
        assert!(get_token_hash(&token) == b"token_hash_abc", 1);
        assert!(is_token_used(&token) == false, 2);
        
        destroy_token_for_testing(token);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_token_expiration() {
    let mut scenario = test_scenario::begin(USER);
    
    test_scenario::next_tx(&mut scenario, USER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let ad_id = object::id_from_address(@0xAD01);
        
        let token = create_token_for_testing(
            ad_id,
            b"content_123",
            b"token_hash",
            1000,   // created_at
            2000,   // expires_at
            ctx
        );
        
        // Clock before expiration
        let mut clock_obj = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_obj, 1500);
        assert!(is_token_expired(&token, &clock_obj) == false, 0);
        
        // Clock after expiration
        clock::set_for_testing(&mut clock_obj, 2500);
        assert!(is_token_expired(&token, &clock_obj) == true, 1);
        
        clock::destroy_for_testing(clock_obj);
        destroy_token_for_testing(token);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_token_not_used_initially() {
    let mut scenario = test_scenario::begin(USER);
    
    test_scenario::next_tx(&mut scenario, USER);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        let ad_id = object::id_from_address(@0xAD01);
        
        let token = create_token_for_testing(
            ad_id,
            b"content_123",
            b"token_hash",
            1000,
            2000,
            ctx
        );
        
        assert!(is_token_used(&token) == false, 0);
        
        destroy_token_for_testing(token);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_init_creates_registry() {
    let mut scenario = test_scenario::begin(ADMIN);
    
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        init_for_testing(ctx);
    };
    
    // Verify registry was created and shared (conversion verification uses AdminCap from ad_payments)
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        assert!(test_scenario::has_most_recent_shared<ClickTokenRegistry>(), 0);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_registry_starts_empty() {
    let mut scenario = test_scenario::begin(ADMIN);
    
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        init_for_testing(ctx);
    };
    
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let registry = test_scenario::take_shared<ClickTokenRegistry>(&scenario);
        let (clicks, conversions) = get_registry_stats(&registry);
        
        assert!(clicks == 0, 0);
        assert!(conversions == 0, 1);
        
        test_scenario::return_shared(registry);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_create_and_verify_click_token_with_registry() {
    let mut scenario = test_scenario::begin(ADMIN);
    
    // Initialize registry
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        init_for_testing(ctx);
    };
    
    // Create click token
    test_scenario::next_tx(&mut scenario, USER);
    {
        let mut registry = test_scenario::take_shared<ClickTokenRegistry>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        let ad_id = object::id_from_address(@0xAD01);
        
        let mut clock_obj = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_obj, 1000);
        
        create_click_token(
            &mut registry,
            ad_id,
            b"content_abc",
            b"random_nonce",
            &clock_obj,
            ctx
        );
        
        // Check registry stats
        let (clicks, conversions) = get_registry_stats(&registry);
        assert!(clicks == 1, 0);
        assert!(conversions == 0, 1);
        
        clock::destroy_for_testing(clock_obj);
        test_scenario::return_shared(registry);
    };
    
    // Verify the token was transferred to user
    test_scenario::next_tx(&mut scenario, USER);
    {
        let registry = test_scenario::take_shared<ClickTokenRegistry>(&scenario);
        let token = test_scenario::take_from_address<ClickToken>(&scenario, USER);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let mut clock_obj = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock_obj, 1500);
        
        // Verify token is valid
        let is_valid = verify_click_token(&token, &registry, &clock_obj);
        assert!(is_valid == true, 2);
        
        clock::destroy_for_testing(clock_obj);
        test_scenario::return_to_address(USER, token);
        test_scenario::return_shared(registry);
    };
    
    test_scenario::end(scenario);
}

#[test]
fun test_no_conversion_initially() {
    let mut scenario = test_scenario::begin(ADMIN);
    
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let ctx = test_scenario::ctx(&mut scenario);
        init_for_testing(ctx);
    };
    
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let registry = test_scenario::take_shared<ClickTokenRegistry>(&scenario);
        
        // Random token hash should have no conversion
        let has_conv = has_conversion(&registry, b"nonexistent_hash");
        assert!(has_conv == false, 0);
        
        test_scenario::return_shared(registry);
    };
    
    test_scenario::end(scenario);
}
