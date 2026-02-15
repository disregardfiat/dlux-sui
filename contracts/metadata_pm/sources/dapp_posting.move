module dlux::dapp_posting;

use sui::event;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::object::{Self, UID};
use sui::transfer;
use sui::hash;
use sui::bcs;
use sui::table::{Self, Table};
use dlux::governance::{Self, GovernanceConfig};
use dlux::prediction_market::{Self, PMRegistry};

/// Error codes
const E_INVALID_NAME: u64 = 1;
const E_INSUFFICIENT_FEE: u64 = 3;
const E_INVALID_PERMLINK: u64 = 6;
const E_BLOB_IDS_EMPTY: u64 = 7;
const E_INPUT_TOO_LONG: u64 = 8;
const E_DUPLICATE_PERMLINK: u64 = 9;
const E_INVALID_WITHDRAW_RECIPIENT: u64 = 10;
const E_DAPP_NOT_FOUND: u64 = 11;
const E_NOT_OWNER: u64 = 12;
const E_UPDATE_LOCKED: u64 = 13;
const E_FEE_OVER_CAP: u64 = 14;

/// Minimum posting fee (in MIST)
const MIN_POSTING_FEE: u64 = 1_000_000_000; // 1 SUI
/// Soft cap on posting fee (10 SUI) - very large fees could be withdrawn by admin; governance can adjust
const MAX_POSTING_FEE: u64 = 10_000_000_000;

/// Storage cost constants (matches walrus-service calculation)
const TERM_LENGTH_DAYS: u64 = 730;
const COST_PER_GB_PER_YEAR_MIST: u64 = 10_000_000; // 0.01 SUI per GB per year = 10M MIST per GB per year
const BYTES_PER_GB: u64 = 1_073_741_824; // 1024^3

/// Max length for name, permlink, category, description, version (bytes)
const MAX_FIELD_LEN: u64 = 2048;
/// Max length for manifest/JSON (can be larger than other fields)
const MAX_MANIFEST_LEN: u64 = 8192;
/// Max number of blob IDs or tags
const MAX_VECTOR_LEN: u64 = 64;

/// No metadata updates for this period after posting (PM resolves on initial data; prevents creator attack vectors)
const UPDATE_LOCK_MS: u64 = 259200000; // 3 days

/// Canonical foundation address - cannot be overridden by callers
const FOUNDATION_ADDRESS: address = @0x875c645ad7ebf67f9a793b374d298394b6848d5b40a13cfa9bd00cab73f45a48;

/// Treasury config - canonical addresses for fee distribution (admin-updatable)
public struct PostingTreasuryConfig has key {
    id: UID,
    pm_pool_address: address,
    foundation_address: address,
    walrus_storage_fund_address: address, // Walrus storage fund address for paying storage costs
}

/// Posting fee pool - collects fees for PM creation
public struct PostingFeePool has key {
    id: UID,
    balance: Balance<SUI>,
    total_collected: u64,
}

/// Admin capability for managing posting fees
public struct PostingAdminCap has key, store {
    id: UID,
}

/// dApp posted event - emitted when a dApp is posted on-chain
public struct DappPosted has copy, drop {
    dapp_id: vector<u8>,            // Unique dApp identifier (hash bytes)
    name: vector<u8>,               // dApp name
    description: vector<u8>,         // dApp description
    owner: address,                 // dApp owner (poster)
    permlink: vector<u8>,           // Permalink/slug
    version: vector<u8>,            // Version string
    manifest: vector<u8>,           // JSON manifest (serialized)
    blob_ids: vector<vector<u8>>,   // Walrus blob IDs
    tags: vector<vector<u8>>,       // Tags
    category: vector<u8>,           // Category
    posting_fee: u64,               // Posting fee paid (in MIST)
    timestamp: u64,                 // Timestamp from Clock
}

/// Prediction market triggered event (PM created off-chain)
public struct PredictionMarketTriggered has copy, drop {
    dapp_id: vector<u8>,            // dApp identifier (hash bytes)
    posting_fee_contribution: u64,  // Portion of posting fee for PM
    triggered_by: address,
}

/// Emitted when the creator's posting fee buys them a YES position in the PM.
/// The PM pool receives this amount and credits the creator with a YES vote.
public struct CreatorYesBought has copy, drop {
    dapp_id: vector<u8>,
    creator: address,
    amount: u64,                    // SUI (MIST) sent to PM pool as YES vote
}

/// Emitted when admin updates PM fee recipient (audit trail)
public struct PMFeeRecipientUpdated has copy, drop {
    old_pm_pool: address,
    new_pm_pool: address,
}

/// On-chain record for a posted dApp (time lock + mute; metadata is in events/indexer)
public struct DappRecord has store, drop {
    owner: address,
    posted_at_ms: u64,
    muted: bool,
}

/// Registry: claimed (owner,permlink) -> true, records dapp_id -> DappRecord
public struct DappRegistry has key {
    id: UID,
    /// Key = hash(owner || permlink); prevents duplicate permlink per owner
    claimed: Table<vector<u8>, bool>,
    /// Key = dapp_id (32 bytes); value = DappRecord for time lock and mute
    records: Table<vector<u8>, DappRecord>,
}

/// Emitted when creator mutes/unmutes their dApp (visible to indexers; less ads/viewers/slashing)
public struct DappMuteUpdated has copy, drop {
    dapp_id: vector<u8>,
    muted: bool,
    owner: address,
}

/// Emitted when metadata is updated after the 3-day lock (indexer picks up)
public struct DappMetadataUpdated has copy, drop {
    dapp_id: vector<u8>,
    owner: address,
    name: vector<u8>,
    description: vector<u8>,
    version: vector<u8>,
    manifest: vector<u8>,
    blob_ids: vector<vector<u8>>,
    tags: vector<vector<u8>>,
    category: vector<u8>,
    updated_at_ms: u64,
}

/// Initialize the posting fee pool, treasury config, and dApp registry
fun init(ctx: &mut TxContext) {
    // Create admin capability
    let admin_cap = PostingAdminCap {
        id: object::new(ctx),
    };
    transfer::transfer(admin_cap, ctx.sender());

    // Create shared treasury config (canonical addresses - caller cannot override)
    // Note: walrus_storage_fund_address should be set via set_walrus_storage_fund_address after init
    let config = PostingTreasuryConfig {
        id: object::new(ctx),
        pm_pool_address: ctx.sender(), // Admin updates via set_fee_recipients
        foundation_address: FOUNDATION_ADDRESS,
        walrus_storage_fund_address: ctx.sender(), // Temporary: admin updates via set_walrus_storage_fund_address
    };
    transfer::share_object(config);

    // Create shared posting fee pool
    let pool = PostingFeePool {
        id: object::new(ctx),
        balance: balance::zero(),
        total_collected: 0,
    };
    transfer::share_object(pool);

    // Create shared dApp registry (claimed permlinks + records for time lock / mute)
    let registry = DappRegistry {
        id: object::new(ctx),
        claimed: table::new(ctx),
        records: table::new(ctx),
    };
    transfer::share_object(registry);
}

/// Update PM pool fee recipient (admin only). Foundation address is fixed and cannot be changed.
public fun set_fee_recipients(
    config: &mut PostingTreasuryConfig,
    pm_pool_address: address,
    _admin: &PostingAdminCap,
) {
    let old_pm = config.pm_pool_address;
    config.pm_pool_address = pm_pool_address;
    event::emit(PMFeeRecipientUpdated {
        old_pm_pool: old_pm,
        new_pm_pool: pm_pool_address,
    });
}

/// Post a dApp on-chain.
///
/// Fee structure:  total fee >= 2 × walrus_storage_cost + governance.votable_posting_fee.
/// After paying Walrus, the remainder is split 50/50:
///   - 50 % → Foundation
///   - 50 % → On-chain prediction market (creator's initial YES position; PM duration from governance)
///
/// Duplicate (owner, permlink) is rejected.  Emits DappPosted for indexer; stores
/// record for time lock and mute.
public fun post_dapp(
    registry: &mut DappRegistry,
    pool: &mut PostingFeePool,
    config: &PostingTreasuryConfig,
    gov: &GovernanceConfig,
    pm_registry: &mut PMRegistry,
    name: vector<u8>,
    description: vector<u8>,
    permlink: vector<u8>,
    version: vector<u8>,
    manifest: vector<u8>,
    blob_ids: vector<vector<u8>>,
    blob_sizes: vector<u64>,
    tags: vector<vector<u8>>,
    category: vector<u8>,
    posting_fee: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let owner = ctx.sender();

    // ── Input validation (gas / DoS) ──
    let name_len = vector::length(&name);
    assert!(name_len > 0, E_INVALID_NAME);
    assert!(name_len <= MAX_FIELD_LEN, E_INPUT_TOO_LONG);
    let permlink_len = vector::length(&permlink);
    assert!(permlink_len > 0, E_INVALID_PERMLINK);
    assert!(permlink_len <= MAX_FIELD_LEN, E_INPUT_TOO_LONG);
    assert!(vector::length(&blob_ids) > 0, E_BLOB_IDS_EMPTY);
    assert!(vector::length(&blob_ids) <= MAX_VECTOR_LEN, E_INPUT_TOO_LONG);
    assert!(vector::length(&blob_sizes) == vector::length(&blob_ids), E_INPUT_TOO_LONG);
    assert!(vector::length(&description) <= MAX_FIELD_LEN, E_INPUT_TOO_LONG);
    assert!(vector::length(&version) <= MAX_FIELD_LEN, E_INPUT_TOO_LONG);
    assert!(vector::length(&manifest) <= MAX_MANIFEST_LEN, E_INPUT_TOO_LONG);
    assert!(vector::length(&tags) <= MAX_VECTOR_LEN, E_INPUT_TOO_LONG);
    assert!(vector::length(&category) <= MAX_FIELD_LEN, E_INPUT_TOO_LONG);

    // ── Calculate storage cost on-chain from blob sizes ──
    let mut total_bytes = 0u64;
    let mut i = 0u64;
    while (i < vector::length(&blob_sizes)) {
        total_bytes = total_bytes + *vector::borrow(&blob_sizes, i);
        i = i + 1;
    };
    let storage_cost_mist = (total_bytes * COST_PER_GB_PER_YEAR_MIST * TERM_LENGTH_DAYS) / (BYTES_PER_GB * 365);

    // ── Minimum fee: 2 × storage + governable votable fee ──
    let votable_fee = governance::get_votable_fee(gov);
    let calculated_min = (storage_cost_mist * 2) + votable_fee;
    // Floor at the legacy MIN_POSTING_FEE for safety
    let min_fee_mist = if (calculated_min < MIN_POSTING_FEE) { MIN_POSTING_FEE } else { calculated_min };

    let fee_amount = coin::value(&posting_fee);
    assert!(fee_amount >= min_fee_mist, E_INSUFFICIENT_FEE);
    assert!(fee_amount <= MAX_POSTING_FEE, E_FEE_OVER_CAP);

    // ── Duplicate permlink check ──
    let mut claimed_key_input = vector::empty<u8>();
    vector::append(&mut claimed_key_input, bcs::to_bytes(&owner));
    vector::append(&mut claimed_key_input, permlink);
    let claimed_key = hash::keccak256(&claimed_key_input);
    assert!(!table::contains(&registry.claimed, claimed_key), E_DUPLICATE_PERMLINK);
    table::add(&mut registry.claimed, claimed_key, true);

    // ── Generate unique dApp ID (before fee distribution so we can create PM) ──
    let mut id_input = vector::empty<u8>();
    vector::append(&mut id_input, bcs::to_bytes(&owner));
    vector::append(&mut id_input, permlink);
    vector::append(&mut id_input, bcs::to_bytes(&clock.timestamp_ms()));
    let id_bytes = hash::keccak256(&id_input);

    // ── Deposit full fee, then distribute ──
    balance::join(&mut pool.balance, coin::into_balance(posting_fee));
    pool.total_collected = pool.total_collected + fee_amount;

    // 1. Storage cost → Walrus fund
    let walrus_storage_cost = if (storage_cost_mist > fee_amount) { fee_amount } else { storage_cost_mist };
    let remainder = fee_amount - walrus_storage_cost;

    if (walrus_storage_cost > 0) {
        let walrus_bal = balance::split(&mut pool.balance, walrus_storage_cost);
        transfer::public_transfer(coin::from_balance(walrus_bal, ctx), config.walrus_storage_fund_address);
    };

    // 2. Remainder: 50 % Foundation, 50 % on-chain PM (creator's initial YES position)
    let pm_duration_ms = governance::get_pm_duration(gov);
    let ends_at_ms = clock.timestamp_ms() + pm_duration_ms;
    let creator_yes_amount = if (remainder > 0) {
        let foundation_half = remainder / 2;
        let creator_yes_half = remainder - foundation_half;
        let foundation_bal = balance::split(&mut pool.balance, foundation_half);
        let creator_yes_bal = balance::split(&mut pool.balance, creator_yes_half);
        transfer::public_transfer(coin::from_balance(foundation_bal, ctx), config.foundation_address);
        let creator_yes_coin = coin::from_balance(creator_yes_bal, ctx);
        let id_for_pm = copy id_bytes;
        prediction_market::create_and_share_market(
            pm_registry,
            id_for_pm,
            owner,
            creator_yes_coin,
            ends_at_ms,
            clock.timestamp_ms(),
            ctx,
        );
        creator_yes_half
    } else {
        0
    };

    // ── Store record (time lock = governance PM duration; mute = false) ──
    let record = DappRecord {
        owner,
        posted_at_ms: clock.timestamp_ms(),
        muted: false,
    };
    table::add(&mut registry.records, id_bytes, record);

    // ── Events ──
    event::emit(DappPosted {
        dapp_id: id_bytes,
        name,
        description,
        owner,
        permlink,
        version,
        manifest,
        blob_ids,
        tags,
        category,
        posting_fee: fee_amount,
        timestamp: clock.timestamp_ms(),
    });

    event::emit(PredictionMarketTriggered {
        dapp_id: id_bytes,
        posting_fee_contribution: creator_yes_amount,
        triggered_by: owner,
    });

    event::emit(CreatorYesBought {
        dapp_id: id_bytes,
        creator: owner,
        amount: creator_yes_amount,
    });
}

/// Get posting fee pool balance
public fun get_pool_balance(pool: &PostingFeePool): u64 {
    balance::value(&pool.balance)
}

/// Get total collected fees
public fun get_total_collected(pool: &PostingFeePool): u64 {
    pool.total_collected
}

/// Withdraw posting fees (admin only). Recipient restricted to canonical PM pool or foundation.
public fun withdraw_posting_fees(
    pool: &mut PostingFeePool,
    config: &PostingTreasuryConfig,
    amount: u64,
    recipient: address,
    _admin: &PostingAdminCap,
    ctx: &mut TxContext
) {
    assert!(balance::value(&pool.balance) >= amount, E_INSUFFICIENT_FEE);
    assert!(recipient == config.pm_pool_address || recipient == config.foundation_address, E_INVALID_WITHDRAW_RECIPIENT);

    let withdraw_balance = balance::split(&mut pool.balance, amount);
    let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
    transfer::public_transfer(withdraw_coin, recipient);
}

/// Creator mutes or unmutes their dApp (any time). Visible to indexers; reduces ads/viewers/slashing; bugs can be mitigated while PM resolves on initial data.
public fun set_muted(
    registry: &mut DappRegistry,
    dapp_id: vector<u8>,
    muted: bool,
    ctx: &mut TxContext
) {
    assert!(table::contains(&registry.records, dapp_id), E_DAPP_NOT_FOUND);
    let record = table::borrow_mut(&mut registry.records, dapp_id);
    assert!(record.owner == ctx.sender(), E_NOT_OWNER);
    record.muted = muted;
    event::emit(DappMuteUpdated {
        dapp_id,
        muted,
        owner: record.owner,
    });
}

/// Update dApp metadata after the PM lock period.  Only owner; indexer picks up event.
/// Lock duration is read from GovernanceConfig (floored at legacy UPDATE_LOCK_MS).
public fun update_dapp_metadata(
    registry: &mut DappRegistry,
    gov: &GovernanceConfig,
    dapp_id: vector<u8>,
    name: vector<u8>,
    description: vector<u8>,
    version: vector<u8>,
    manifest: vector<u8>,
    blob_ids: vector<vector<u8>>,
    tags: vector<vector<u8>>,
    category: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    assert!(table::contains(&registry.records, dapp_id), E_DAPP_NOT_FOUND);
    let record = table::borrow(&registry.records, dapp_id);
    assert!(record.owner == ctx.sender(), E_NOT_OWNER);
    // Use governance PM duration, floored at the legacy minimum for safety
    let lock_ms = governance::get_pm_duration(gov);
    let effective_lock = if (lock_ms > UPDATE_LOCK_MS) { lock_ms } else { UPDATE_LOCK_MS };
    assert!(clock.timestamp_ms() >= record.posted_at_ms + effective_lock, E_UPDATE_LOCKED);
    assert!(vector::length(&name) > 0 && vector::length(&name) <= MAX_FIELD_LEN, E_INVALID_NAME);
    assert!(vector::length(&description) <= MAX_FIELD_LEN, E_INPUT_TOO_LONG);
    assert!(vector::length(&version) <= MAX_FIELD_LEN, E_INPUT_TOO_LONG);
    assert!(vector::length(&manifest) <= MAX_MANIFEST_LEN, E_INPUT_TOO_LONG);
    assert!(vector::length(&blob_ids) > 0 && vector::length(&blob_ids) <= MAX_VECTOR_LEN, E_BLOB_IDS_EMPTY);
    assert!(vector::length(&tags) <= MAX_VECTOR_LEN, E_INPUT_TOO_LONG);
    assert!(vector::length(&category) <= MAX_FIELD_LEN, E_INPUT_TOO_LONG);

    event::emit(DappMetadataUpdated {
        dapp_id,
        owner: record.owner,
        name,
        description,
        version,
        manifest,
        blob_ids,
        tags,
        category,
        updated_at_ms: clock.timestamp_ms(),
    });
}

/// Read whether a dApp is muted (for indexers / frontends)
public fun is_muted(registry: &DappRegistry, dapp_id: vector<u8>): bool {
    if (!table::contains(&registry.records, dapp_id)) {
        return false
    };
    let record = table::borrow(&registry.records, dapp_id);
    record.muted
}

// ===== Test functions =====

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun create_posting_treasury_config_for_testing(
    pm_pool: address,
    foundation: address,
    walrus_storage_fund: address,
    ctx: &mut TxContext
): PostingTreasuryConfig {
    PostingTreasuryConfig {
        id: object::new(ctx),
        pm_pool_address: pm_pool,
        foundation_address: foundation,
        walrus_storage_fund_address: walrus_storage_fund,
    }
}

#[test_only]
public fun destroy_posting_treasury_config_for_testing(config: PostingTreasuryConfig) {
    let PostingTreasuryConfig { id, pm_pool_address: _, foundation_address: _, walrus_storage_fund_address: _ } = config;
    object::delete(id);
}

#[test_only]
public fun create_posting_fee_pool_for_testing(
    initial_balance: Coin<SUI>,
    ctx: &mut TxContext
): PostingFeePool {
    let balance_val = coin::value(&initial_balance);
    PostingFeePool {
        id: object::new(ctx),
        balance: coin::into_balance(initial_balance),
        total_collected: balance_val,
    }
}

#[test_only]
public fun create_dapp_registry_for_testing(ctx: &mut TxContext): DappRegistry {
    DappRegistry {
        id: object::new(ctx),
        claimed: table::new(ctx),
        records: table::new(ctx),
    }
}

#[test_only]
public fun return_registry_to_sender_for_testing(registry: DappRegistry, ctx: &mut TxContext) {
    transfer::transfer(registry, ctx.sender());
}

#[test_only]
public fun destroy_posting_fee_pool_for_testing(pool: PostingFeePool, ctx: &mut TxContext) {
    let PostingFeePool { id, mut balance, total_collected: _ } = pool;
    // Drain balance to sender before destroy (pool may have fees from post_dapp)
    let amount = balance::value(&balance);
    if (amount > 0) {
        let withdraw = balance::split(&mut balance, amount);
        balance::destroy_zero(balance);
        let coin = coin::from_balance(withdraw, ctx);
        transfer::public_transfer(coin, ctx.sender());
    } else {
        balance::destroy_zero(balance);
    };
    object::delete(id);
}
