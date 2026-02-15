module dlux::ad_campaigns;

use sui::event;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::clock::Clock;
use sui::object::{Self, ID, UID};
use sui::transfer;
use dlux::ad_payments::{Self, CampaignEscrow, RevenuePool, AdminCap};
use dlux::governance::GovernanceConfig;

/// Campaign status constants
const STATUS_ACTIVE: u8 = 0;
const STATUS_PAUSED: u8 = 1;
const STATUS_CANCELLED: u8 = 2;
const STATUS_EXPIRED: u8 = 3;
const STATUS_BUDGET_DEPLETED: u8 = 4;
const STATUS_PAUSED_BY_OWNER: u8 = 5;

/// Bounds on vector inputs (gas / DoS)
const MAX_PLACEMENTS: u64 = 32;
const MAX_USER_ZONES: u64 = 32;
const MAX_CONTENT_ZONES: u64 = 32;
/// Cooldown between metadata updates (align with posting time-lock), in ms
const METADATA_UPDATE_COOLDOWN_MS: u64 = 7 * 24 * 60 * 60 * 1000;
/// Min escrow lock duration (1 day), prevents immediate refund
const MIN_LOCK_DURATION_MS: u64 = 24 * 60 * 60 * 1000;
/// Max length for title / description / target_url (align with posting style)
const MAX_METADATA_LEN: u64 = 512;

/// Error codes
const E_NOT_ADVERTISER: u64 = 1;
const E_INSUFFICIENT_BUDGET: u64 = 4;
const E_INVALID_BID: u64 = 5;
const E_INVALID_BUDGET: u64 = 6;
const E_INVALID_DATES: u64 = 7;
const E_ALREADY_PAUSED: u64 = 8;
const E_ALREADY_ACTIVE: u64 = 9;
const E_CAMPAIGN_CANCELLED: u64 = 10;
const E_INVALID_STATUS_FOR_PAUSE: u64 = 11;
const E_NOT_OWNER_PAUSED: u64 = 12;
const E_CAMPAIGN_PAUSED_BY_OWNER: u64 = 13;
const E_UPDATE_COOLDOWN: u64 = 14;
const E_TOO_MANY_PLACEMENTS: u64 = 15;
const E_TOO_MANY_USER_ZONES: u64 = 16;
const E_TOO_MANY_CONTENT_ZONES: u64 = 17;
const E_INVALID_PLANET: u64 = 18;
const E_LOCK_TOO_SHORT: u64 = 19;
const E_INVALID_TITLE: u64 = 20;
const E_INVALID_DESCRIPTION: u64 = 21;
const E_INVALID_TARGET_URL: u64 = 22;
const E_ALREADY_PAUSED_BY_OWNER: u64 = 23;

/// Ad Campaign object
public struct AdCampaign has key, store {
    id: UID,
    advertiser: address,
    title: vector<u8>,
    description: vector<u8>,
    target_url: vector<u8>,
    placements: vector<vector<u8>>, // e.g., ["gate", "slip", "install"]
    bid: u64, // SUI amount per impression (in MIST)
    total_budget: u64,
    remaining_budget: u64,
    status: u8,
    start_at: u64, // timestamp in ms
    end_at: u64, // timestamp in ms
    created_at: u64,
    impression_count: u64,
    // Targeting fields
    user_zones: vector<vector<u8>>, // GeoIP zones (e.g., ["US", "EU", "ASIA"])
    content_zones: vector<vector<u8>>, // Content location zones
    planet: Option<u8>, // 0=Earth, 1=Moon, 2=Mars (optional for digital twin)
    escrow_id: Option<ID>, // Reference to CampaignEscrow
    last_metadata_update_ts: u64, // For update cooldown (ms)
    /// Future: pointer to shared governance config (bid/status overrides, etc.)
    governance_override_id: Option<ID>,
}

/// Campaign created event
public struct CampaignCreated has copy, drop {
    campaign_id: ID,
    advertiser: address,
    title: vector<u8>,
    bid: u64,
    total_budget: u64,
}

/// Campaign updated event
public struct CampaignUpdated has copy, drop {
    campaign_id: ID,
    title: vector<u8>,
    description: vector<u8>,
    target_url: vector<u8>,
}

/// Campaign status changed event
public struct CampaignStatusChanged has copy, drop {
    campaign_id: ID,
    old_status: u8,
    new_status: u8,
}

/// Impression recorded event
public struct ImpressionRecorded has copy, drop {
    campaign_id: ID,
    cost: u64,
    remaining_budget: u64,
}

/// Campaign cancelled and refund event
public struct CampaignCancelled has copy, drop {
    campaign_id: ID,
    refund_amount: u64,
}

/// Campaign paused by owner (advertiser) — stops impressions and further escrow drain
public struct CampaignPausedByOwner has copy, drop {
    campaign_id: ID,
    advertiser: address,
    timestamp: u64,
}

/// Campaign budget depleted (auto-transition)
public struct CampaignBudgetDepleted has copy, drop {
    campaign_id: ID,
    remaining_budget: u64,
}

/// Campaign resumed from owner-pause (audit symmetry with CampaignPausedByOwner)
public struct CampaignResumedFromOwnerPause has copy, drop {
    campaign_id: ID,
    advertiser: address,
    timestamp: u64,
}

/// Campaign auto-expired (end_at passed)
public struct CampaignExpired has copy, drop {
    campaign_id: ID,
    end_at: u64,
}

/// Entry function: Create a new ad campaign with escrow
public entry fun create_campaign_entry(
    payment: Coin<SUI>,
    title: vector<u8>,
    description: vector<u8>,
    target_url: vector<u8>,
    placements: vector<vector<u8>>,
    bid: u64,
    start_at: u64,
    end_at: u64,
    user_zones: vector<vector<u8>>,
    content_zones: vector<vector<u8>>,
    planet: Option<u8>,
    lock_duration_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    create_campaign(
        payment,
        title,
        description,
        target_url,
        placements,
        bid,
        start_at,
        end_at,
        user_zones,
        content_zones,
        planet,
        lock_duration_ms,
        clock,
        ctx
    );
}

/// Create a new ad campaign with escrow
public fun create_campaign(
    payment: Coin<SUI>,
    title: vector<u8>,
    description: vector<u8>,
    target_url: vector<u8>,
    placements: vector<vector<u8>>,
    bid: u64,
    start_at: u64,
    end_at: u64,
    user_zones: vector<vector<u8>>,
    content_zones: vector<vector<u8>>,
    planet: Option<u8>,
    lock_duration_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // Validate inputs
    assert!(lock_duration_ms >= MIN_LOCK_DURATION_MS, E_LOCK_TOO_SHORT);
    assert!(vector::length(&title) > 0 && vector::length(&title) <= MAX_METADATA_LEN, E_INVALID_TITLE);
    assert!(vector::length(&description) <= MAX_METADATA_LEN, E_INVALID_DESCRIPTION);
    assert!(vector::length(&target_url) > 0 && vector::length(&target_url) <= MAX_METADATA_LEN, E_INVALID_TARGET_URL);
    let budget = coin::value(&payment);
    assert!(budget > 0, E_INVALID_BUDGET);
    assert!(bid > 0, E_INVALID_BID);
    assert!(end_at > start_at, E_INVALID_DATES);
    assert!(vector::length(&placements) <= MAX_PLACEMENTS, E_TOO_MANY_PLACEMENTS);
    assert!(vector::length(&user_zones) <= MAX_USER_ZONES, E_TOO_MANY_USER_ZONES);
    assert!(vector::length(&content_zones) <= MAX_CONTENT_ZONES, E_TOO_MANY_CONTENT_ZONES);
    if (option::is_some(&planet)) {
        assert!(*option::borrow(&planet) <= 2, E_INVALID_PLANET);
    };
    
    let now = clock.timestamp_ms();
    assert!(end_at > now, E_INVALID_DATES);
    
    let advertiser = ctx.sender();
    let campaign_uid = object::new(ctx);
    let campaign_id = campaign_uid.to_inner();
    
    // Create escrow for campaign funds (properly escrows the payment)
    let escrow_id = ad_payments::create_escrow(campaign_id, payment, lock_duration_ms, clock, ctx);
    
    let campaign = AdCampaign {
        id: campaign_uid,
        advertiser,
        title: title,
        description,
        target_url,
        placements,
        bid,
        total_budget: budget,
        remaining_budget: budget,
        status: STATUS_ACTIVE,
        start_at,
        end_at,
        created_at: now,
        impression_count: 0,
        user_zones,
        content_zones,
        planet,
        escrow_id: option::some(escrow_id),
        last_metadata_update_ts: now,
        governance_override_id: option::none(),
    };
    
    event::emit(CampaignCreated {
        campaign_id,
        advertiser,
        title: title,
        bid,
        total_budget: budget,
    });
    
    transfer::share_object(campaign);
}

/// Wire the AdCampaign's governance_override_id to the actual GovernanceConfig object.
/// Called once by admin after governance module is deployed.
public fun set_governance_config(
    campaign: &mut AdCampaign,
    gov: &GovernanceConfig,
    _admin: &AdminCap,
) {
    campaign.governance_override_id = option::some(object::id(gov));
}

/// Update campaign details (only advertiser). Cooldown between updates (align with posting).
public fun update_campaign(
    campaign: &mut AdCampaign,
    title: vector<u8>,
    description: vector<u8>,
    target_url: vector<u8>,
    clock: &Clock,
    ctx: &TxContext
) {
    assert!(ctx.sender() == campaign.advertiser, E_NOT_ADVERTISER);
    assert!(campaign.status != STATUS_CANCELLED, E_CAMPAIGN_CANCELLED);
    assert!(campaign.status != STATUS_PAUSED_BY_OWNER, E_CAMPAIGN_PAUSED_BY_OWNER);
    let now = clock.timestamp_ms();
    assert!(now >= campaign.last_metadata_update_ts + METADATA_UPDATE_COOLDOWN_MS, E_UPDATE_COOLDOWN);
    
    campaign.title = title;
    campaign.description = description;
    campaign.target_url = target_url;
    campaign.last_metadata_update_ts = now;
    
    event::emit(CampaignUpdated {
        campaign_id: campaign.id.to_inner(),
        title,
        description,
        target_url,
    });
}

/// Pause an active campaign (legacy pause; use pause_by_owner for full stop)
public fun pause_campaign(
    campaign: &mut AdCampaign,
    ctx: &TxContext
) {
    assert!(ctx.sender() == campaign.advertiser, E_NOT_ADVERTISER);
    assert!(campaign.status != STATUS_PAUSED_BY_OWNER, E_ALREADY_PAUSED_BY_OWNER);
    assert!(campaign.status == STATUS_ACTIVE, E_ALREADY_PAUSED);

    let old_status = campaign.status;
    campaign.status = STATUS_PAUSED;
    
    event::emit(CampaignStatusChanged {
        campaign_id: campaign.id.to_inner(),
        old_status,
        new_status: STATUS_PAUSED,
    });
}

/// Resume a paused campaign
public fun resume_campaign(
    campaign: &mut AdCampaign,
    clock: &Clock,
    ctx: &TxContext
) {
    assert!(ctx.sender() == campaign.advertiser, E_NOT_ADVERTISER);
    assert!(campaign.status == STATUS_PAUSED, E_ALREADY_ACTIVE);
    
    let now = clock.timestamp_ms();
    assert!(now < campaign.end_at, E_INVALID_DATES);
    assert!(campaign.remaining_budget >= campaign.bid, E_INSUFFICIENT_BUDGET);
    
    let old_status = campaign.status;
    campaign.status = STATUS_ACTIVE;
    
    event::emit(CampaignStatusChanged {
        campaign_id: campaign.id.to_inner(),
        old_status,
        new_status: STATUS_ACTIVE,
    });
}

/// Pause campaign by owner (advertiser). Stops further impressions and escrow drain.
public fun pause_by_owner(
    campaign: &mut AdCampaign,
    clock: &Clock,
    ctx: &TxContext
) {
    assert!(ctx.sender() == campaign.advertiser, E_NOT_ADVERTISER);
    assert!(
        campaign.status == STATUS_ACTIVE || campaign.status == STATUS_PAUSED,
        E_INVALID_STATUS_FOR_PAUSE
    );
    let old_status = campaign.status;
    campaign.status = STATUS_PAUSED_BY_OWNER;
    let now = clock.timestamp_ms();
    event::emit(CampaignPausedByOwner {
        campaign_id: campaign.id.to_inner(),
        advertiser: campaign.advertiser,
        timestamp: now,
    });
    event::emit(CampaignStatusChanged {
        campaign_id: campaign.id.to_inner(),
        old_status,
        new_status: STATUS_PAUSED_BY_OWNER,
    });
}

/// Resume from owner-pause back to active.
public fun resume_from_owner_pause(
    campaign: &mut AdCampaign,
    clock: &Clock,
    ctx: &TxContext
) {
    assert!(ctx.sender() == campaign.advertiser, E_NOT_ADVERTISER);
    assert!(campaign.status == STATUS_PAUSED_BY_OWNER, E_NOT_OWNER_PAUSED);
    let now = clock.timestamp_ms();
    assert!(now < campaign.end_at, E_INVALID_DATES);
    assert!(campaign.remaining_budget >= campaign.bid, E_INSUFFICIENT_BUDGET);
    let old_status = campaign.status;
    campaign.status = STATUS_ACTIVE;
    event::emit(CampaignResumedFromOwnerPause {
        campaign_id: campaign.id.to_inner(),
        advertiser: campaign.advertiser,
        timestamp: now,
    });
    event::emit(CampaignStatusChanged {
        campaign_id: campaign.id.to_inner(),
        old_status,
        new_status: STATUS_ACTIVE,
    });
}

/// Cancel campaign and return remaining budget
/// Note: Actual refund requires escrow contract interaction
public fun cancel_campaign(
    campaign: &mut AdCampaign,
    ctx: &TxContext
) {
    assert!(ctx.sender() == campaign.advertiser, E_NOT_ADVERTISER);
    assert!(campaign.status != STATUS_CANCELLED, E_CAMPAIGN_CANCELLED);
    
    let old_status = campaign.status;
    let refund_amount = campaign.remaining_budget;
    
    campaign.status = STATUS_CANCELLED;
    campaign.remaining_budget = 0;
    
    event::emit(CampaignStatusChanged {
        campaign_id: campaign.id.to_inner(),
        old_status,
        new_status: STATUS_CANCELLED,
    });
    
    event::emit(CampaignCancelled {
        campaign_id: campaign.id.to_inner(),
        refund_amount,
    });
    
    // Note: Actual SUI refund handled by escrow contract
}

/// Entry function: Record impression and withdraw from escrow
/// Requires Merkle proof of impression (same params as ad_payments::withdraw_for_impression).
public entry fun record_impression_with_escrow(
    campaign: &mut AdCampaign,
    escrow: &mut CampaignEscrow,
    pool: &mut RevenuePool,
    gov: &GovernanceConfig,
    proof_hashes: vector<vector<u8>>,
    proof_paths: vector<vector<vector<u8>>>,
    proof_indices: vector<vector<u8>>,
    content_id: vector<u8>,
    root_hash: vector<u8>,
    leaf_count: u64,
    threshold: u64,
    admin: &AdminCap,
    clock: &Clock,
): bool {
    if (!deduct_impression_cost(campaign, clock)) {
        return false
    };
    ad_payments::withdraw_for_impression(
        escrow,
        campaign.bid,
        pool,
        gov,
        proof_hashes,
        proof_paths,
        proof_indices,
        content_id,
        root_hash,
        leaf_count,
        threshold,
        admin,
    )
}

/// Deduct impression cost from campaign budget via escrow
/// Called by authorized impression verifier
/// Note: This function updates campaign state; actual withdrawal from escrow
/// must be done via ad_payments::withdraw_for_impression
public fun deduct_impression_cost(
    campaign: &mut AdCampaign,
    clock: &Clock,
): bool {
    assert!(campaign.status != STATUS_PAUSED_BY_OWNER, E_CAMPAIGN_PAUSED_BY_OWNER);
    let now = clock.timestamp_ms();
    
    if (campaign.status != STATUS_ACTIVE) {
        return false
    };
    
    if (now < campaign.start_at || now > campaign.end_at) {
        if (now > campaign.end_at) {
            campaign.status = STATUS_EXPIRED;
            event::emit(CampaignExpired {
                campaign_id: campaign.id.to_inner(),
                end_at: campaign.end_at,
            });
        };
        return false
    };
    
    if (campaign.remaining_budget < campaign.bid) {
        campaign.status = STATUS_BUDGET_DEPLETED;
        event::emit(CampaignBudgetDepleted {
            campaign_id: campaign.id.to_inner(),
            remaining_budget: campaign.remaining_budget,
        });
        return false
    };
    
    campaign.remaining_budget = campaign.remaining_budget - campaign.bid;
    campaign.impression_count = campaign.impression_count + 1;
    
    if (campaign.remaining_budget < campaign.bid) {
        campaign.status = STATUS_BUDGET_DEPLETED;
        event::emit(CampaignBudgetDepleted {
            campaign_id: campaign.id.to_inner(),
            remaining_budget: campaign.remaining_budget,
        });
    };
    
    event::emit(ImpressionRecorded {
        campaign_id: campaign.id.to_inner(),
        cost: campaign.bid,
        remaining_budget: campaign.remaining_budget,
    });
    
    true
}

// ===== View functions =====

/// Get campaign status
public fun get_status(campaign: &AdCampaign): u8 {
    campaign.status
}

/// Get remaining budget
public fun get_remaining_budget(campaign: &AdCampaign): u64 {
    campaign.remaining_budget
}

/// Get campaign bid
public fun get_bid(campaign: &AdCampaign): u64 {
    campaign.bid
}

/// Get campaign advertiser
public fun get_advertiser(campaign: &AdCampaign): address {
    campaign.advertiser
}

/// Get impression count
public fun get_impression_count(campaign: &AdCampaign): u64 {
    campaign.impression_count
}

/// Check if campaign is active and has budget (excludes owner-paused)
public fun is_active_with_budget(campaign: &AdCampaign, clock: &Clock): bool {
    let now = clock.timestamp_ms();
    campaign.status == STATUS_ACTIVE &&
    campaign.status != STATUS_PAUSED_BY_OWNER &&
    now >= campaign.start_at &&
    now <= campaign.end_at &&
    campaign.remaining_budget >= campaign.bid
}

/// Check if campaign is paused by owner (advertiser)
public fun is_owner_paused(campaign: &AdCampaign): bool {
    campaign.status == STATUS_PAUSED_BY_OWNER
}

/// Get user zones (geoIP targeting)
public fun get_user_zones(campaign: &AdCampaign): vector<vector<u8>> {
    campaign.user_zones
}

/// Get content zones
public fun get_content_zones(campaign: &AdCampaign): vector<vector<u8>> {
    campaign.content_zones
}

/// Get planet (0=Earth, 1=Moon, 2=Mars)
public fun get_planet(campaign: &AdCampaign): Option<u8> {
    campaign.planet
}

/// Get escrow ID
public fun get_escrow_id(campaign: &AdCampaign): Option<ID> {
    campaign.escrow_id
}

// ===== Test functions =====

#[test_only]
public fun create_campaign_for_testing(
    advertiser: address,
    title: vector<u8>,
    bid: u64,
    budget: u64,
    start_at: u64,
    end_at: u64,
    ctx: &mut TxContext
): AdCampaign {
    AdCampaign {
        id: object::new(ctx),
        advertiser,
        title,
        description: b"test description",
        target_url: b"https://test.com",
        placements: vector[b"gate", b"slip"],
        bid,
        total_budget: budget,
        remaining_budget: budget,
        status: STATUS_ACTIVE,
        start_at,
        end_at,
        created_at: start_at,
        impression_count: 0,
        user_zones: vector[],
        content_zones: vector[],
        planet: option::none(),
        escrow_id: option::none(),
        last_metadata_update_ts: start_at,
        governance_override_id: option::none(),
    }
}

#[test_only]
public fun destroy_for_testing(campaign: AdCampaign) {
    let AdCampaign { id, advertiser: _, title: _, description: _, target_url: _,
        placements: _, bid: _, total_budget: _, remaining_budget: _, status: _,
        start_at: _, end_at: _, created_at: _, impression_count: _,
        user_zones: _, content_zones: _, planet: _, escrow_id: _,
        last_metadata_update_ts: _, governance_override_id: _ } = campaign;
    object::delete(id);
}
