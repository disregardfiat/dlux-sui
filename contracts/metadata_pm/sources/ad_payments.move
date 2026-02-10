module dlux::ad_payments;

use sui::event;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use dlux::merkle_verifier;
use dlux::governance::{Self, GovernanceConfig};

/// DoS / dust bounds
const MIN_WITHDRAW_AMOUNT: u64 = 100_000;   // 100k MIST minimum per withdraw
const MIN_DRAWDOWN_AMOUNT: u64 = 100_000;   // 100k MIST minimum per drawdown
const MAX_WALRUS_PROOFS: u64 = 100;
const MAX_CONTENT_ID_LEN: u64 = 64;

/// Error codes
const E_NOT_CAMPAIGN_OWNER: u64 = 1;
const E_ESCROW_LOCKED: u64 = 2;
const E_INSUFFICIENT_FUNDS: u64 = 3;
const E_ZERO_AMOUNT: u64 = 5;
const E_ALREADY_FINALIZED: u64 = 6;
const E_INVALID_VERIFICATION: u64 = 7;
const E_INVALID_PROOF: u64 = 8;
const E_POOL_PAUSED: u64 = 9;
const E_TOO_MANY_PROOFS: u64 = 10;
const E_INPUT_TOO_LONG: u64 = 11;
const E_BELOW_MIN_WITHDRAW: u64 = 12;
const E_BELOW_MIN_DRAWDOWN: u64 = 13;
const E_ESCROW_PAUSED: u64 = 14;
const E_PM_FAILED_ADS_DISABLED: u64 = 15;
const E_CREATOR_ESCROW_RESOLVED: u64 = 16;
const E_INVALID_PM_STATUS: u64 = 17;

/// Campaign Escrow - holds funds for ad campaign
public struct CampaignEscrow has key {
    id: UID,
    campaign_id: ID,
    advertiser: address,
    balance: Balance<SUI>,
    total_deposited: u64,
    total_withdrawn: u64,
    locked_until: u64, // timestamp for refund eligibility
    is_finalized: bool,
    /// When true, withdraw_for_impression is blocked (advertiser can pause/unpause)
    paused: bool,
}

/// Revenue Pool - collects impression revenue for distribution
public struct RevenuePool has key {
    id: UID,
    balance: Balance<SUI>,
    total_collected: u64,
    last_distribution: u64,
    /// When true, withdraw_for_impression and walrus_drawdown are blocked
    paused: bool,
    /// Canonical creator address for distribute_revenue (50% share); set at init to deployer
    creator: address,
    /// Future: pointer to shared governance object (splits, max proofs, etc.)
    governance_config_id: Option<ID>,
}

/// Admin capability for revenue distribution
public struct AdminCap has key, store {
    id: UID,
}

/// Escrow created event
public struct EscrowCreated has copy, drop {
    escrow_id: ID,
    campaign_id: ID,
    advertiser: address,
    amount: u64,
    locked_until: u64,
}

/// Withdrawal event
public struct FundsWithdrawn has copy, drop {
    escrow_id: ID,
    amount: u64,
    remaining: u64,
}

/// Refund event
public struct EscrowRefunded has copy, drop {
    escrow_id: ID,
    advertiser: address,
    amount: u64,
}

/// Funds added to escrow (advertiser)
public struct FundsAddedToEscrow has copy, drop {
    escrow_id: ID,
    amount: u64,
    advertiser: address,
}

/// Transfer to revenue pool event
public struct TransferredToPool has copy, drop {
    escrow_id: ID,
    pool_id: ID,
    amount: u64,
}

/// Revenue distributed event
public struct RevenueDistributed has copy, drop {
    pool_id: ID,
    creator_share: u64,
    pm_share: u64,
    foundation_share: u64,
}

/// Walrus drawdown event - when Walrus node draws down from pool.
/// pm_status: 0 = active (during PM), 1 = passed, 2 = failed (should not occur; aborts).
public struct WalrusDrawdown has copy, drop {
    pool_id: ID,
    walrus_provider: address,
    content_id: vector<u8>,
    amount: u64,
    gateway_share: u64,
    foundation_share: u64,
    creator_share: u64,
    pm_pool_share: u64,
    pm_status: u8,
}

// ───── Creator PM Escrow (holds creator's 41% during PM) ─────

/// Holds the creator's share of ad revenue during the PM period.
/// If PM passes → released to creator.  If PM fails → forfeited to PM pool.
public struct CreatorPMEscrow has key {
    id: UID,
    dapp_id: vector<u8>,
    creator: address,
    balance: Balance<SUI>,
    total_escrowed: u64,
    resolved: bool,
}

/// Emitted when a CreatorPMEscrow is created.
public struct CreatorEscrowCreated has copy, drop {
    escrow_id: ID,
    dapp_id: vector<u8>,
    creator: address,
}

/// Emitted when creator escrow is resolved (success → creator, failure → PM pool).
public struct CreatorEscrowResolved has copy, drop {
    escrow_id: ID,
    dapp_id: vector<u8>,
    pm_passed: bool,
    amount: u64,
    recipient: address,
}

/// Revenue pool paused (admin only)
public struct RevenuePoolPaused has copy, drop {
    pool_id: ID,
    timestamp_ms: u64,
}

/// Revenue pool unpaused (admin only)
public struct RevenuePoolUnpaused has copy, drop {
    pool_id: ID,
    timestamp_ms: u64,
}

/// Initialize module - create admin cap and revenue pool
fun init(ctx: &mut TxContext) {
    // Create admin capability
    let admin_cap = AdminCap {
        id: object::new(ctx),
    };
    transfer::transfer(admin_cap, ctx.sender());
    
    // Create shared revenue pool (creator = deployer for distribute_revenue 50% share)
    let pool = RevenuePool {
        id: object::new(ctx),
        balance: balance::zero(),
        total_collected: 0,
        last_distribution: 0,
        paused: false,
        creator: ctx.sender(),
        governance_config_id: option::none(),
    };
    transfer::share_object(pool);
}

/// Create an escrow for a campaign
/// Returns the escrow ID for linking to campaign
public fun create_escrow(
    campaign_id: ID,
    payment: Coin<SUI>,
    lock_duration_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext
): ID {
    let amount = coin::value(&payment);
    assert!(amount > 0, E_ZERO_AMOUNT);
    
    let advertiser = ctx.sender();
    let now = clock.timestamp_ms();
    let locked_until = now + lock_duration_ms;
    
    let escrow_uid = object::new(ctx);
    let escrow_id = escrow_uid.to_inner();
    
    let escrow = CampaignEscrow {
        id: escrow_uid,
        campaign_id,
        advertiser,
        balance: coin::into_balance(payment),
        total_deposited: amount,
        total_withdrawn: 0,
        locked_until,
        is_finalized: false,
        paused: false,
    };
    
    event::emit(EscrowCreated {
        escrow_id,
        campaign_id,
        advertiser,
        amount,
        locked_until,
    });
    
    transfer::share_object(escrow);
    escrow_id
}

/// Pause revenue pool (blocks withdraw_for_impression and walrus_drawdown)
public fun pause_revenue_pool(
    pool: &mut RevenuePool,
    _admin: &AdminCap,
    clock: &Clock,
) {
    pool.paused = true;
    event::emit(RevenuePoolPaused {
        pool_id: object::id(pool),
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Unpause revenue pool
public fun unpause_revenue_pool(
    pool: &mut RevenuePool,
    _admin: &AdminCap,
    clock: &Clock,
) {
    pool.paused = false;
    event::emit(RevenuePoolUnpaused {
        pool_id: object::id(pool),
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Pause escrow (advertiser only). Blocks withdraw_for_impression until unpause.
public fun pause_escrow(escrow: &mut CampaignEscrow, ctx: &TxContext) {
    assert!(ctx.sender() == escrow.advertiser, E_NOT_CAMPAIGN_OWNER);
    assert!(!escrow.is_finalized, E_ALREADY_FINALIZED);
    escrow.paused = true;
}

/// Unpause escrow (advertiser only).
public fun unpause_escrow(escrow: &mut CampaignEscrow, ctx: &TxContext) {
    assert!(ctx.sender() == escrow.advertiser, E_NOT_CAMPAIGN_OWNER);
    escrow.paused = false;
}

/// Add more funds to escrow
public fun add_funds(
    escrow: &mut CampaignEscrow,
    payment: Coin<SUI>,
    ctx: &TxContext
) {
    assert!(ctx.sender() == escrow.advertiser, E_NOT_CAMPAIGN_OWNER);
    assert!(!escrow.is_finalized, E_ALREADY_FINALIZED);
    
    let amount = coin::value(&payment);
    escrow.total_deposited = escrow.total_deposited + amount;
    balance::join(&mut escrow.balance, coin::into_balance(payment));
    event::emit(FundsAddedToEscrow {
        escrow_id: escrow.id.to_inner(),
        amount,
        advertiser: escrow.advertiser,
    });
}

/// Withdraw from escrow for impression payment
/// Requires on-chain Merkle verification (same as walrus_drawdown). Called after deduct_impression_cost.
public fun withdraw_for_impression(
    escrow: &mut CampaignEscrow,
    amount: u64,
    pool: &mut RevenuePool,
    proof_hashes: vector<vector<u8>>,
    proof_paths: vector<vector<vector<u8>>>,
    proof_indices: vector<vector<u8>>,
    content_id: vector<u8>,
    root_hash: vector<u8>,
    leaf_count: u64,
    threshold: u64,
    _admin: &AdminCap,
): bool {
    assert!(!pool.paused, E_POOL_PAUSED);
    assert!(!escrow.paused, E_ESCROW_PAUSED);
    if (escrow.is_finalized) {
        return false
    };
    assert!(amount >= MIN_WITHDRAW_AMOUNT, E_BELOW_MIN_WITHDRAW);
    assert!(amount > 0, E_ZERO_AMOUNT);
    let proof_count = vector::length(&proof_hashes);
    assert!(proof_count <= MAX_WALRUS_PROOFS, E_TOO_MANY_PROOFS);
    assert!(proof_count > 0, E_INVALID_VERIFICATION);
    assert!(vector::length(&content_id) <= MAX_CONTENT_ID_LEN, E_INPUT_TOO_LONG);

    let mut content_id_copy = vector::empty<u8>();
    let len = vector::length(&content_id);
    let mut idx = 0u64;
    while (idx < len) {
        vector::push_back(&mut content_id_copy, *vector::borrow(&content_id, idx));
        idx = idx + 1;
    };
    let merkle_root = merkle_verifier::create_merkle_root(content_id_copy, root_hash, leaf_count, threshold);
    assert!(
        merkle_verifier::verify_batch_ad_views(&merkle_root, proof_hashes, proof_paths, proof_indices),
        E_INVALID_PROOF
    );

    let available = balance::value(&escrow.balance);
    if (available < amount) {
        return false
    };

    let withdrawn = balance::split(&mut escrow.balance, amount);
    escrow.total_withdrawn = escrow.total_withdrawn + amount;
    pool.total_collected = pool.total_collected + amount;
    balance::join(&mut pool.balance, withdrawn);

    event::emit(FundsWithdrawn {
        escrow_id: escrow.id.to_inner(),
        amount,
        remaining: balance::value(&escrow.balance),
    });
    event::emit(TransferredToPool {
        escrow_id: escrow.id.to_inner(),
        pool_id: pool.id.to_inner(),
        amount,
    });
    true
}

/// Refund remaining balance to advertiser
/// Only allowed after lock period or campaign end
public fun refund_escrow(
    escrow: &mut CampaignEscrow,
    clock: &Clock,
    ctx: &mut TxContext
) {
    assert!(ctx.sender() == escrow.advertiser, E_NOT_CAMPAIGN_OWNER);
    
    let now = clock.timestamp_ms();
    assert!(now >= escrow.locked_until, E_ESCROW_LOCKED);
    assert!(!escrow.is_finalized, E_ALREADY_FINALIZED);
    
    let refund_amount = balance::value(&escrow.balance);
    if (refund_amount > 0) {
        let refund_balance = balance::withdraw_all(&mut escrow.balance);
        let refund_coin = coin::from_balance(refund_balance, ctx);
        transfer::public_transfer(refund_coin, escrow.advertiser);
    };
    event::emit(EscrowRefunded {
        escrow_id: escrow.id.to_inner(),
        advertiser: escrow.advertiser,
        amount: refund_amount,
    });
    escrow.is_finalized = true;
}

/// Finalize escrow - mark as complete, no more operations allowed
public fun finalize_escrow(
    escrow: &mut CampaignEscrow,
    _admin: &AdminCap,
    ctx: &mut TxContext
) {
    assert!(!escrow.is_finalized, E_ALREADY_FINALIZED);
    let remaining = balance::value(&escrow.balance);
    if (remaining > 0) {
        let refund_balance = balance::withdraw_all(&mut escrow.balance);
        let refund_coin = coin::from_balance(refund_balance, ctx);
        transfer::public_transfer(refund_coin, escrow.advertiser);
    };
    event::emit(EscrowRefunded {
        escrow_id: escrow.id.to_inner(),
        advertiser: escrow.advertiser,
        amount: remaining,
    });
    escrow.is_finalized = true;
}

/// Entry function: Distribute revenue from pool using GovernanceConfig splits.
/// pm_status: 0 = active, 1 = passed.  Status 2 (failed) aborts — ads are disabled.
public entry fun distribute_revenue_entry(
    pool: &mut RevenuePool,
    gov: &GovernanceConfig,
    amount: u64,
    pm_status: u8,
    foundation: address,
    pm_pool: address,
    clock: &Clock,
    admin: &AdminCap,
    ctx: &mut TxContext
) {
    distribute_revenue(pool, gov, amount, pm_status, foundation, pm_pool, clock, admin, ctx);
}

/// Distribute revenue from pool.
///
/// During PM (status 0):  foundation / gateway(→pool.creator) / creator-escrow / PM pool
/// After PM success (1):  foundation / gateway(→pool.creator) / creator / 0
/// After PM failure (2):  abort — ads disabled.
///
/// Reads split percentages from GovernanceConfig.
public fun distribute_revenue(
    pool: &mut RevenuePool,
    gov: &GovernanceConfig,
    amount: u64,
    pm_status: u8,
    foundation: address,
    pm_pool: address,
    clock: &Clock,
    _admin: &AdminCap,
    ctx: &mut TxContext
) {
    assert!(!pool.paused, E_POOL_PAUSED);
    assert!(pm_status <= 2, E_INVALID_PM_STATUS);
    assert!(pm_status != governance::pm_status_failed(), E_PM_FAILED_ADS_DISABLED);
    assert!(balance::value(&pool.balance) >= amount, E_INSUFFICIENT_FUNDS);

    let (f_pct, _g_pct, c_pct, p_pct) = if (pm_status == governance::pm_status_active()) {
        (governance::get_pm_foundation_pct(gov),
         governance::get_pm_gateway_pct(gov),
         governance::get_pm_creator_pct(gov),
         governance::get_pm_pool_pct(gov))
    } else {
        (governance::get_post_foundation_pct(gov),
         governance::get_post_gateway_pct(gov),
         governance::get_post_creator_pct(gov),
         governance::get_post_pm_pct(gov))
    };

    let foundation_share = amount * f_pct / 100;
    let creator_share = amount * c_pct / 100;
    let pm_share = amount * p_pct / 100;
    // Gateway share absorbs rounding dust
    let gateway_share = amount - foundation_share - creator_share - pm_share;

    let foundation_bal = balance::split(&mut pool.balance, foundation_share);
    let creator_bal = balance::split(&mut pool.balance, creator_share);
    let gateway_bal = balance::split(&mut pool.balance, gateway_share);

    transfer::public_transfer(coin::from_balance(foundation_bal, ctx), foundation);
    transfer::public_transfer(coin::from_balance(creator_bal, ctx), pool.creator);
    transfer::public_transfer(coin::from_balance(gateway_bal, ctx), pool.creator); // gateway = pool creator for now

    if (pm_share > 0) {
        let pm_bal = balance::split(&mut pool.balance, pm_share);
        transfer::public_transfer(coin::from_balance(pm_bal, ctx), pm_pool);
    };

    pool.last_distribution = clock.timestamp_ms();
    event::emit(RevenueDistributed {
        pool_id: pool.id.to_inner(),
        creator_share,
        pm_share,
        foundation_share,
    });
}

/// Entry function: Walrus node drawdown from revenue pool (governance-aware).
///
/// pm_status: 0 = PM active, 1 = PM passed, 2 = PM failed (aborts).
/// During PM (0):  foundation 10 %, gateway 9 %, creator escrow 41 %, PM pool 40 %
/// After pass (1): foundation 10 %, gateway 9 %, creator 81 %, PM pool 0 %
public entry fun walrus_drawdown_entry(
    pool: &mut RevenuePool,
    gov: &GovernanceConfig,
    creator_escrow: &mut CreatorPMEscrow,
    proof_hashes: vector<vector<u8>>,
    proof_paths: vector<vector<vector<u8>>>,
    proof_indices: vector<vector<u8>>,
    content_id: vector<u8>,
    root_hash: vector<u8>,
    leaf_count: u64,
    threshold: u64,
    pm_status: u8,
    pm_pool: address,
    creator: address,
    foundation: address,
    walrus_provider: address,
    amount: u64,
    clock: &Clock,
    admin: &AdminCap,
    ctx: &mut TxContext
) {
    walrus_drawdown(
        pool, gov, creator_escrow,
        proof_hashes, proof_paths, proof_indices,
        content_id, root_hash, leaf_count, threshold,
        pm_status, pm_pool, creator, foundation, walrus_provider,
        amount, clock, admin, ctx,
    );
}

/// Walrus node drawdown from revenue pool (governance-aware).
///
/// Revenue splits are read from GovernanceConfig:
///   During PM (status 0):
///     foundation_pct (10) | gateway_pct (9) | creator_pct (41 → escrow) | pm_pool_pct (40)
///   After PM success (status 1):
///     foundation_pct (10) | gateway_pct (9) | creator_pct (81 → creator) | pm_pct (0)
///   After PM failure (status 2):
///     Aborts — ads are disabled.
///
/// Requires on-chain Merkle verification of ad impressions.
public fun walrus_drawdown(
    pool: &mut RevenuePool,
    gov: &GovernanceConfig,
    creator_escrow: &mut CreatorPMEscrow,
    proof_hashes: vector<vector<u8>>,
    proof_paths: vector<vector<vector<u8>>>,
    proof_indices: vector<vector<u8>>,
    content_id: vector<u8>,
    root_hash: vector<u8>,
    leaf_count: u64,
    threshold: u64,
    pm_status: u8,
    pm_pool: address,
    creator: address,
    foundation: address,
    walrus_provider: address,
    amount: u64,
    clock: &Clock,
    _admin: &AdminCap,
    ctx: &mut TxContext
) {
    assert!(!pool.paused, E_POOL_PAUSED);
    assert!(pm_status <= 2, E_INVALID_PM_STATUS);
    assert!(pm_status != governance::pm_status_failed(), E_PM_FAILED_ADS_DISABLED);
    assert!(balance::value(&pool.balance) >= amount, E_INSUFFICIENT_FUNDS);
    assert!(amount >= MIN_DRAWDOWN_AMOUNT, E_BELOW_MIN_DRAWDOWN);
    assert!(amount > 0, E_ZERO_AMOUNT);
    assert!(vector::length(&proof_hashes) <= MAX_WALRUS_PROOFS, E_TOO_MANY_PROOFS);
    assert!(vector::length(&content_id) <= MAX_CONTENT_ID_LEN, E_INPUT_TOO_LONG);

    let proof_count = vector::length(&proof_hashes);
    assert!(proof_count > 0, E_INVALID_VERIFICATION);

    // Copy content_id for Merkle root (create_merkle_root consumes it)
    let mut content_id_copy = vector::empty<u8>();
    let len = vector::length(&content_id);
    let mut idx = 0u64;
    while (idx < len) {
        vector::push_back(&mut content_id_copy, *vector::borrow(&content_id, idx));
        idx = idx + 1;
    };
    let merkle_root = merkle_verifier::create_merkle_root(content_id_copy, root_hash, leaf_count, threshold);
    assert!(
        merkle_verifier::verify_batch_ad_views(&merkle_root, proof_hashes, proof_paths, proof_indices),
        E_INVALID_PROOF,
    );

    // Read splits from GovernanceConfig based on PM status
    let (f_pct, g_pct, c_pct, p_pct) = if (pm_status == governance::pm_status_active()) {
        (governance::get_pm_foundation_pct(gov),
         governance::get_pm_gateway_pct(gov),
         governance::get_pm_creator_pct(gov),
         governance::get_pm_pool_pct(gov))
    } else {
        (governance::get_post_foundation_pct(gov),
         governance::get_post_gateway_pct(gov),
         governance::get_post_creator_pct(gov),
         governance::get_post_pm_pct(gov))
    };

    let foundation_share = amount * f_pct / 100;
    let creator_share    = amount * c_pct / 100;
    let pm_pool_share    = amount * p_pct / 100;
    // Gateway share absorbs rounding dust
    let gateway_share    = amount - foundation_share - creator_share - pm_pool_share;

    // ── Transfers ──
    let gateway_bal = balance::split(&mut pool.balance, gateway_share);
    transfer::public_transfer(coin::from_balance(gateway_bal, ctx), walrus_provider);

    let foundation_bal = balance::split(&mut pool.balance, foundation_share);
    transfer::public_transfer(coin::from_balance(foundation_bal, ctx), foundation);

    if (pm_status == governance::pm_status_active()) {
        // During PM: creator share → escrow (held until PM resolves)
        if (creator_share > 0) {
            let creator_bal = balance::split(&mut pool.balance, creator_share);
            balance::join(&mut creator_escrow.balance, creator_bal);
            creator_escrow.total_escrowed = creator_escrow.total_escrowed + creator_share;
        };
    } else {
        // After PM pass: creator share → creator directly
        if (creator_share > 0) {
            let creator_bal = balance::split(&mut pool.balance, creator_share);
            transfer::public_transfer(coin::from_balance(creator_bal, ctx), creator);
        };
    };

    if (pm_pool_share > 0) {
        let pm_bal = balance::split(&mut pool.balance, pm_pool_share);
        transfer::public_transfer(coin::from_balance(pm_bal, ctx), pm_pool);
    };

    pool.last_distribution = clock.timestamp_ms();

    event::emit(WalrusDrawdown {
        pool_id: pool.id.to_inner(),
        walrus_provider,
        content_id,
        amount,
        gateway_share,
        foundation_share,
        creator_share,
        pm_pool_share,
        pm_status,
    });
}

// ───── Governance config wiring ─────

/// Wire the RevenuePool's governance_config_id to the actual GovernanceConfig object.
/// Called once by admin after governance module is deployed.
public fun set_governance_config(
    pool: &mut RevenuePool,
    gov: &GovernanceConfig,
    _admin: &AdminCap,
) {
    pool.governance_config_id = option::some(object::id(gov));
}

// ───── Creator PM Escrow lifecycle ─────

/// Create a CreatorPMEscrow for a newly posted dApp.  Called by the backend when
/// a dApp is posted and the prediction market starts.
public fun create_creator_escrow(
    dapp_id: vector<u8>,
    creator: address,
    _admin: &AdminCap,
    ctx: &mut TxContext,
): ID {
    let uid = object::new(ctx);
    let escrow_id = uid.to_inner();

    event::emit(CreatorEscrowCreated {
        escrow_id,
        dapp_id,
        creator,
    });

    let escrow = CreatorPMEscrow {
        id: uid,
        dapp_id,
        creator,
        balance: balance::zero(),
        total_escrowed: 0,
        resolved: false,
    };
    transfer::share_object(escrow);
    escrow_id
}

/// PM resolved YES → release escrowed funds to creator.
public fun resolve_escrow_success(
    escrow: &mut CreatorPMEscrow,
    _admin: &AdminCap,
    ctx: &mut TxContext,
) {
    assert!(!escrow.resolved, E_CREATOR_ESCROW_RESOLVED);
    escrow.resolved = true;

    let amount = balance::value(&escrow.balance);
    if (amount > 0) {
        let bal = balance::withdraw_all(&mut escrow.balance);
        transfer::public_transfer(coin::from_balance(bal, ctx), escrow.creator);
    };

    event::emit(CreatorEscrowResolved {
        escrow_id: object::id(escrow),
        dapp_id: escrow.dapp_id,
        pm_passed: true,
        amount,
        recipient: escrow.creator,
    });
}

/// PM resolved NO → forfeit escrowed funds to PM pool.
public fun resolve_escrow_failure(
    escrow: &mut CreatorPMEscrow,
    pm_pool: address,
    _admin: &AdminCap,
    ctx: &mut TxContext,
) {
    assert!(!escrow.resolved, E_CREATOR_ESCROW_RESOLVED);
    escrow.resolved = true;

    let amount = balance::value(&escrow.balance);
    if (amount > 0) {
        let bal = balance::withdraw_all(&mut escrow.balance);
        transfer::public_transfer(coin::from_balance(bal, ctx), pm_pool);
    };

    event::emit(CreatorEscrowResolved {
        escrow_id: object::id(escrow),
        dapp_id: escrow.dapp_id,
        pm_passed: false,
        amount,
        recipient: pm_pool,
    });
}

// ===== View functions =====

/// Get escrow balance
public fun get_balance(escrow: &CampaignEscrow): u64 {
    balance::value(&escrow.balance)
}

/// Get escrow advertiser
public fun get_advertiser(escrow: &CampaignEscrow): address {
    escrow.advertiser
}

/// Get escrow campaign ID
public fun get_campaign_id(escrow: &CampaignEscrow): ID {
    escrow.campaign_id
}

/// Check if escrow is finalized
public fun is_finalized(escrow: &CampaignEscrow): bool {
    escrow.is_finalized
}

/// Check if lock period has passed
public fun is_unlocked(escrow: &CampaignEscrow, clock: &Clock): bool {
    clock.timestamp_ms() >= escrow.locked_until
}

/// Check if escrow is paused (advertiser set pause)
public fun is_escrow_paused(escrow: &CampaignEscrow): bool {
    escrow.paused
}

/// Check if revenue pool is paused
public fun is_paused(pool: &RevenuePool): bool {
    pool.paused
}

/// Get pool balance
public fun get_pool_balance(pool: &RevenuePool): u64 {
    balance::value(&pool.balance)
}

/// Get total collected by pool
public fun get_total_collected(pool: &RevenuePool): u64 {
    pool.total_collected
}

// ===== Test functions =====

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun create_escrow_for_testing(
    campaign_id: ID,
    advertiser: address,
    amount: u64,
    locked_until: u64,
    ctx: &mut TxContext
): CampaignEscrow {
    CampaignEscrow {
        id: object::new(ctx),
        campaign_id,
        advertiser,
        balance: balance::zero(),
        total_deposited: amount,
        total_withdrawn: 0,
        locked_until,
        is_finalized: false,
        paused: false,
    }
}

#[test_only]
public fun destroy_escrow_for_testing(escrow: CampaignEscrow) {
    let CampaignEscrow { id, campaign_id: _, advertiser: _, balance,
        total_deposited: _, total_withdrawn: _, locked_until: _, is_finalized: _, paused: _ } = escrow;
    balance::destroy_zero(balance);
    object::delete(id);
}

#[test_only]
public fun create_revenue_pool_for_testing(
    initial_balance: Coin<SUI>,
    ctx: &mut TxContext
): RevenuePool {
    let balance_val = coin::value(&initial_balance);
    RevenuePool {
        id: object::new(ctx),
        balance: coin::into_balance(initial_balance),
        total_collected: balance_val,
        last_distribution: 0,
        paused: false,
        creator: ctx.sender(),
        governance_config_id: option::none(),
    }
}

#[test_only]
public fun destroy_revenue_pool_for_testing(pool: RevenuePool, ctx: &mut TxContext) {
    let RevenuePool { id, mut balance, total_collected: _, last_distribution: _, paused: _, creator: _, governance_config_id: _ } = pool;
    let amount = balance::value(&balance);
    if (amount > 0) {
        let withdraw = balance::split(&mut balance, amount);
        balance::destroy_zero(balance);
        transfer::public_transfer(coin::from_balance(withdraw, ctx), ctx.sender());
    } else {
        balance::destroy_zero(balance);
    };
    object::delete(id);
}

#[test_only]
public fun create_creator_pm_escrow_for_testing(
    dapp_id: vector<u8>,
    creator: address,
    ctx: &mut TxContext,
): CreatorPMEscrow {
    CreatorPMEscrow {
        id: object::new(ctx),
        dapp_id,
        creator,
        balance: balance::zero(),
        total_escrowed: 0,
        resolved: false,
    }
}

#[test_only]
public fun destroy_creator_pm_escrow_for_testing(escrow: CreatorPMEscrow, ctx: &mut TxContext) {
    let CreatorPMEscrow { id, dapp_id: _, creator, mut balance, total_escrowed: _, resolved: _ } = escrow;
    let amount = balance::value(&balance);
    if (amount > 0) {
        let withdraw = balance::split(&mut balance, amount);
        balance::destroy_zero(balance);
        transfer::public_transfer(coin::from_balance(withdraw, ctx), creator);
    } else {
        balance::destroy_zero(balance);
    };
    object::delete(id);
}

#[test_only]
public fun get_creator_escrow_balance(escrow: &CreatorPMEscrow): u64 {
    balance::value(&escrow.balance)
}

#[test_only]
public fun is_creator_escrow_resolved(escrow: &CreatorPMEscrow): bool {
    escrow.resolved
}
