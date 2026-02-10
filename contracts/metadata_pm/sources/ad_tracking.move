module dlux::ad_tracking;

use sui::event;
use sui::clock::Clock;
use sui::hash;
use sui::bcs;
use sui::table::{Self, Table};
use dlux::ad_payments::AdminCap;

/// Error codes
const E_TOKEN_EXPIRED: u64 = 1;
const E_INVALID_TOKEN: u64 = 2;
const E_TOKEN_ALREADY_USED: u64 = 3;
const E_CONVERSION_EXISTS: u64 = 5;
const E_TRACKING_PAUSED: u64 = 6;
const E_CREATION_COOLDOWN: u64 = 7;
const E_INPUT_TOO_LONG: u64 = 8;

/// Default token TTL: 24 hours in milliseconds
const DEFAULT_TOKEN_TTL_MS: u64 = 86400000;
/// Cooldown between token creations per sender (5 min), in ms
const CREATION_COOLDOWN_MS: u64 = 300000;
/// Max length for nonce / conversion_nonce
const MAX_NONCE_LEN: u64 = 64;

/// Click Token - anonymous token for click tracking
public struct ClickToken has key, store {
    id: UID,
    ad_id: ID,
    content_id: vector<u8>,
    token_hash: vector<u8>, // SHA3-256 hash of (ad_id || content_id || nonce || timestamp)
    created_at: u64,
    expires_at: u64,
    is_used: bool,
}

/// Conversion record - links click to conversion
public struct Conversion has store, drop {
    click_token_hash: vector<u8>,
    conversion_token_hash: vector<u8>,
    ad_id: ID,
    content_id: vector<u8>,
    verified: bool,
    timestamp: u64,
}

/// Click Token Registry - tracks all tokens and conversions
public struct ClickTokenRegistry has key {
    id: UID,
    /// Map from token_hash to whether token exists
    tokens: Table<vector<u8>, bool>,
    /// Map from click_token_hash to conversion
    conversions: Table<vector<u8>, Conversion>,
    total_clicks: u64,
    total_conversions: u64,
    /// When true, create_click_token and record_conversion/verify_conversion are blocked
    paused: bool,
    /// Per-sender last creation timestamp (ms) for cooldown
    last_creation_ts: Table<address, u64>,
}

/// Click token created event
public struct ClickTokenCreated has copy, drop {
    token_id: ID,
    ad_id: ID,
    token_hash: vector<u8>,
    expires_at: u64,
}

/// Token verified event
public struct TokenVerified has copy, drop {
    token_hash: vector<u8>,
    ad_id: ID,
    valid: bool,
}

/// Conversion recorded event
public struct ConversionRecorded has copy, drop {
    click_token_hash: vector<u8>,
    conversion_token_hash: vector<u8>,
    ad_id: ID,
}

/// Conversion verified event
public struct ConversionVerified has copy, drop {
    click_token_hash: vector<u8>,
    ad_id: ID,
    verified: bool,
}

/// Tracking paused (registry-level; aligns with pause in posting/campaigns/pools)
public struct TrackingPaused has copy, drop {
    timestamp: u64,
}

/// Click token marked used (in record_conversion)
public struct ClickTokenUsed has copy, drop {
    click_token_hash: vector<u8>,
    ad_id: ID,
}

/// Initialize module (registry only; conversion verification uses AdminCap from ad_payments)
fun init(ctx: &mut TxContext) {
    let registry = ClickTokenRegistry {
        id: object::new(ctx),
        tokens: table::new(ctx),
        conversions: table::new(ctx),
        total_clicks: 0,
        total_conversions: 0,
        paused: false,
        last_creation_ts: table::new(ctx),
    };
    transfer::share_object(registry);
}

/// Pause registry (admin only). Blocks token creation and conversion recording.
public fun pause_registry(
    registry: &mut ClickTokenRegistry,
    clock: &Clock,
    _admin: &AdminCap,
) {
    registry.paused = true;
    event::emit(TrackingPaused {
        timestamp: clock.timestamp_ms(),
    });
}

/// Create a click token for ad click
public fun create_click_token(
    registry: &mut ClickTokenRegistry,
    ad_id: ID,
    content_id: vector<u8>,
    nonce: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    assert!(!registry.paused, E_TRACKING_PAUSED);
    assert!(vector::length(&nonce) <= MAX_NONCE_LEN, E_INPUT_TOO_LONG);
    let sender = ctx.sender();
    let now = clock.timestamp_ms();
    if (table::contains(&registry.last_creation_ts, sender)) {
        let last = *table::borrow(&registry.last_creation_ts, sender);
        assert!(now >= last + CREATION_COOLDOWN_MS, E_CREATION_COOLDOWN);
        let ts = table::borrow_mut(&mut registry.last_creation_ts, sender);
        *ts = now;
    } else {
        table::add(&mut registry.last_creation_ts, sender, now);
    };

    let expires_at = now + DEFAULT_TOKEN_TTL_MS;

    let mut hash_input = bcs::to_bytes(&ad_id);
    vector::append(&mut hash_input, content_id);
    vector::append(&mut hash_input, nonce);
    vector::append(&mut hash_input, u64_to_bytes(now));

    let token_hash = hash::keccak256(&hash_input);

    assert!(!table::contains(&registry.tokens, token_hash), E_TOKEN_ALREADY_USED);

    let token_uid = object::new(ctx);
    let token_id = token_uid.to_inner();

    let token = ClickToken {
        id: token_uid,
        ad_id,
        content_id,
        token_hash,
        created_at: now,
        expires_at,
        is_used: false,
    };

    table::add(&mut registry.tokens, token_hash, true);
    registry.total_clicks = registry.total_clicks + 1;

    event::emit(ClickTokenCreated {
        token_id,
        ad_id,
        token_hash,
        expires_at,
    });

    transfer::transfer(token, ctx.sender());
}

/// Verify a click token is valid
public fun verify_click_token(
    token: &ClickToken,
    registry: &ClickTokenRegistry,
    clock: &Clock,
): bool {
    let now = clock.timestamp_ms();
    
    // Check not expired
    if (now > token.expires_at) {
        return false
    };
    
    // Check not already used
    if (token.is_used) {
        return false
    };
    
    // Check token exists in registry
    if (!table::contains(&registry.tokens, token.token_hash)) {
        return false
    };
    
    true
}

/// Verify token validity and emit event
public fun verify_token(
    token: &ClickToken,
    registry: &ClickTokenRegistry,
    clock: &Clock,
) {
    let valid = verify_click_token(token, registry, clock);
    
    event::emit(TokenVerified {
        token_hash: token.token_hash,
        ad_id: token.ad_id,
        valid,
    });
}

/// Record a conversion linked to a click token (admin-only; aligns with revenue distribution)
public fun record_conversion(
    token: &mut ClickToken,
    registry: &mut ClickTokenRegistry,
    conversion_nonce: vector<u8>,
    clock: &Clock,
    _admin: &AdminCap,
) {
    assert!(!registry.paused, E_TRACKING_PAUSED);
    assert!(vector::length(&conversion_nonce) <= MAX_NONCE_LEN, E_INPUT_TOO_LONG);
    let now = clock.timestamp_ms();

    assert!(now <= token.expires_at, E_TOKEN_EXPIRED);
    assert!(!token.is_used, E_TOKEN_ALREADY_USED);
    assert!(!table::contains(&registry.conversions, token.token_hash), E_CONVERSION_EXISTS);

    let mut hash_input = token.token_hash;
    vector::append(&mut hash_input, conversion_nonce);
    vector::append(&mut hash_input, u64_to_bytes(now));
    let conversion_token_hash = hash::keccak256(&hash_input);

    let conversion = Conversion {
        click_token_hash: token.token_hash,
        conversion_token_hash,
        ad_id: token.ad_id,
        content_id: token.content_id,
        verified: false,
        timestamp: now,
    };

    table::add(&mut registry.conversions, token.token_hash, conversion);
    registry.total_conversions = registry.total_conversions + 1;

    token.is_used = true;

    event::emit(ClickTokenUsed {
        click_token_hash: token.token_hash,
        ad_id: token.ad_id,
    });
    event::emit(ConversionRecorded {
        click_token_hash: token.token_hash,
        conversion_token_hash,
        ad_id: token.ad_id,
    });
}

/// Verify a conversion (admin-only)
public fun verify_conversion(
    registry: &mut ClickTokenRegistry,
    click_token_hash: vector<u8>,
    _admin: &AdminCap,
) {
    assert!(!registry.paused, E_TRACKING_PAUSED);
    assert!(table::contains(&registry.conversions, click_token_hash), E_INVALID_TOKEN);

    let conversion = table::borrow_mut(&mut registry.conversions, click_token_hash);
    conversion.verified = true;

    event::emit(ConversionVerified {
        click_token_hash: conversion.click_token_hash,
        ad_id: conversion.ad_id,
        verified: true,
    });
}

/// Check if a conversion exists for a click token
public fun has_conversion(
    registry: &ClickTokenRegistry,
    click_token_hash: vector<u8>,
): bool {
    table::contains(&registry.conversions, click_token_hash)
}

/// Check if conversion is verified
public fun is_conversion_verified(
    registry: &ClickTokenRegistry,
    click_token_hash: vector<u8>,
): bool {
    if (!table::contains(&registry.conversions, click_token_hash)) {
        return false
    };
    
    let conversion = table::borrow(&registry.conversions, click_token_hash);
    conversion.verified
}

// ===== View functions =====

/// Get token hash
public fun get_token_hash(token: &ClickToken): vector<u8> {
    token.token_hash
}

/// Get token ad ID
public fun get_token_ad_id(token: &ClickToken): ID {
    token.ad_id
}

/// Check if token is expired
public fun is_token_expired(token: &ClickToken, clock: &Clock): bool {
    clock.timestamp_ms() > token.expires_at
}

/// Check if token is used
public fun is_token_used(token: &ClickToken): bool {
    token.is_used
}

/// Get registry stats
public fun get_registry_stats(registry: &ClickTokenRegistry): (u64, u64) {
    (registry.total_clicks, registry.total_conversions)
}

/// Whether the registry is paused (blocks token creation and conversion recording)
public fun is_registry_paused(registry: &ClickTokenRegistry): bool {
    registry.paused
}

// ===== Helper functions =====

/// Convert u64 to bytes for hashing
fun u64_to_bytes(value: u64): vector<u8> {
    let mut result = vector::empty<u8>();
    let mut i = 0;
    let mut v = value;
    while (i < 8) {
        vector::push_back(&mut result, ((v & 0xFF) as u8));
        v = v >> 8;
        i = i + 1;
    };
    result
}

// ===== Test functions =====

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun create_token_for_testing(
    ad_id: ID,
    content_id: vector<u8>,
    token_hash: vector<u8>,
    created_at: u64,
    expires_at: u64,
    ctx: &mut TxContext
): ClickToken {
    ClickToken {
        id: object::new(ctx),
        ad_id,
        content_id,
        token_hash,
        created_at,
        expires_at,
        is_used: false,
    }
}

#[test_only]
public fun destroy_token_for_testing(token: ClickToken) {
    let ClickToken { id, ad_id: _, content_id: _, token_hash: _, 
        created_at: _, expires_at: _, is_used: _ } = token;
    object::delete(id);
}
