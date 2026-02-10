module dlux::metadata_pm;

use sui::event;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::balance::{Self, Balance};
use sui::transfer;
use dlux::ad_payments::AdminCap;
use dlux::merkle_verifier::{MerkleRoot, verify_batch_ad_views, get_root_hash};
use dlux::governance::{Self, GovernanceConfig};

/// Location metadata for digital twin support
public struct LocationMetadata has store {
    latitude: u64,  // Scaled by 1e6 (e.g., 40600000 = 40.6 degrees)
    longitude: u64, // Scaled by 1e6 (e.g., -74000000 = -74.0 degrees)
    elevation: u64, // Elevation in meters
    planet: u8,     // 0=Earth, 1=Moon, 2=Mars
}

/// Digital twin origin marker (6DOF pose)
public struct DigitalTwinOrigin has store {
    gltf_index: vector<u8>, // GLTF file reference or index
    position_x: u64,        // Position X (scaled)
    position_y: u64,        // Position Y (scaled)
    position_z: u64,        // Position Z (scaled)
    rotation_x: u64,        // Rotation X (quaternion component, scaled)
    rotation_y: u64,        // Rotation Y (quaternion component, scaled)
    rotation_z: u64,        // Rotation Z (quaternion component, scaled)
    rotation_w: u64,        // Rotation W (quaternion component, scaled)
}

/// Ad revenue pool for content
public struct AdRevenuePool has key {
    id: UID,
    content_id: vector<u8>,
    creator: address,
    balance: Balance<SUI>,
    total_revenue: u64,
    distributed: bool,
    /// Merkle root set once when proofs arrive; must match for distribute
    merkle_root: Option<MerkleRoot>,
    /// Creator can pause to prevent distribution during bug/exploit window
    paused: bool,
    /// Future: pointer to shared governance object (splits, max proofs, etc.)
    governance_config_id: Option<ID>,
}

/// ZK proof verification event
public struct ZKProofVerified has copy, drop {
    content_id: vector<u8>,
    merkle_root: vector<u8>,
    verified_count: u64,
}

/// Revenue distributed event
public struct RevenueDistributed has copy, drop {
    content_id: vector<u8>,
    creator_share: u64,
    pm_share: u64,
    foundation_share: u64,
}

/// Pool created event
public struct PoolCreated has copy, drop {
    content_id: vector<u8>,
    creator: address,
    initial_amount: u64,
}

/// Funds added to pool event
public struct FundsAdded has copy, drop {
    content_id: vector<u8>,
    amount: u64,
}

/// Pool paused event (creator only)
public struct PoolPaused has copy, drop {
    content_id: vector<u8>,
    creator: address,
}

/// Pool unpaused event (creator only)
public struct PoolUnpaused has copy, drop {
    content_id: vector<u8>,
    creator: address,
}

/// Error codes
const E_INVALID_ZK_PROOF: u64 = 1;
const E_THRESHOLD_NOT_MET: u64 = 3;
const E_ALREADY_DISTRIBUTED: u64 = 4;
const E_INSUFFICIENT_FUNDS: u64 = 5;
const E_INVALID_MERKLE_PROOF: u64 = 6;
const E_INVALID_THRESHOLD: u64 = 7;
const E_INVALID_PLANET: u64 = 8;
const E_NO_MERKLE_ROOT_SET: u64 = 9;
const E_POOL_PAUSED: u64 = 10;
const E_NOT_POOL_CREATOR: u64 = 11;
const E_TOO_MANY_PROOFS: u64 = 12;
const E_MERKLE_ROOT_ALREADY_SET: u64 = 13;
const E_NOT_PAUSED: u64 = 14;
const E_PROOF_TOO_DEEP: u64 = 15;
const E_TOO_FEW_PROOFS: u64 = 16;
const E_INPUT_TOO_LONG: u64 = 17;
const E_PM_FAILED_ADS_DISABLED: u64 = 18;
const E_INVALID_PM_STATUS: u64 = 19;
const MAX_CONTENT_ID_LEN: u64 = 64;
const MAX_BATCH_PROOFS: u64 = 100;
const MAX_MERKLE_PATH_DEPTH: u64 = 40;

/// Create ad revenue pool with initial SUI payment
public fun create_revenue_pool(
    content_id: vector<u8>,
    payment: Coin<SUI>,
    ctx: &mut TxContext
): AdRevenuePool {
    assert!(vector::length(&content_id) <= MAX_CONTENT_ID_LEN, E_INPUT_TOO_LONG);
    let creator = ctx.sender();
    let total_revenue = coin::value(&payment);
    let pool = AdRevenuePool {
        id: object::new(ctx),
        content_id,
        creator,
        balance: coin::into_balance(payment),
        total_revenue,
        distributed: false,
        merkle_root: option::none(),
        paused: false,
        governance_config_id: option::none(),
    };
    event::emit(PoolCreated {
        content_id,
        creator,
        initial_amount: total_revenue,
    });
    pool
}

/// Add funds to revenue pool (blocked when pool is paused)
public fun add_funds_to_pool(
    pool: &mut AdRevenuePool,
    payment: Coin<SUI>
) {
    assert!(!pool.paused, E_POOL_PAUSED);
    let amount = coin::value(&payment);
    pool.total_revenue = pool.total_revenue + amount;
    balance::join(&mut pool.balance, coin::into_balance(payment));
    event::emit(FundsAdded {
        content_id: pool.content_id,
        amount,
    });
}

/// Set Merkle root for the pool (once). Admin only; root content_id must match pool.
public fun set_merkle_root(
    pool: &mut AdRevenuePool,
    root: MerkleRoot,
    _admin: &AdminCap
) {
    assert!(!pool.distributed, E_ALREADY_DISTRIBUTED);
    assert!(option::is_none(&pool.merkle_root), E_MERKLE_ROOT_ALREADY_SET);
    assert!(dlux::merkle_verifier::get_content_id(&root) == pool.content_id, E_INVALID_MERKLE_PROOF);
    assert!(dlux::merkle_verifier::get_leaf_count(&root) >= dlux::merkle_verifier::get_threshold(&root), E_THRESHOLD_NOT_MET);
    pool.merkle_root = option::some(root);
}

/// Wire the AdRevenuePool's governance_config_id to the actual GovernanceConfig object.
/// Called once by admin after governance module is deployed.
public fun set_governance_config(
    pool: &mut AdRevenuePool,
    gov: &GovernanceConfig,
    _admin: &AdminCap,
) {
    pool.governance_config_id = option::some(object::id(gov));
}

/// Pause pool (creator only). Prevents distribution and adding funds during bug/exploit window.
public fun pause_pool(pool: &mut AdRevenuePool, ctx: &mut TxContext) {
    assert!(ctx.sender() == pool.creator, E_NOT_POOL_CREATOR);
    pool.paused = true;
    event::emit(PoolPaused {
        content_id: pool.content_id,
        creator: pool.creator,
    });
}

/// Unpause pool (creator only). Symmetry with pause_pool.
public fun unpause_pool(pool: &mut AdRevenuePool, ctx: &mut TxContext) {
    assert!(ctx.sender() == pool.creator, E_NOT_POOL_CREATOR);
    assert!(pool.paused, E_NOT_PAUSED);
    pool.paused = false;
    event::emit(PoolUnpaused {
        content_id: pool.content_id,
        creator: pool.creator,
    });
}

/// Distribute revenue when threshold reached.  Requires pool's Merkle root to be set and
/// real batch Merkle verification via proof_hashes/paths/indices.  Admin-only; pool must
/// not be paused.  Split percentages come from GovernanceConfig.
///
/// pm_status: 0 = active, 1 = passed, 2 = failed (aborts — ads disabled).
/// Creator share always goes to pool.creator (no redirect).
public fun distribute_ad_revenue(
    pool: &mut AdRevenuePool,
    gov: &GovernanceConfig,
    proof_hashes: vector<vector<u8>>,
    proof_paths: vector<vector<vector<u8>>>,
    proof_indices: vector<vector<u8>>,
    pm_status: u8,
    foundation: address,
    pm_pool: address,
    _admin: &AdminCap,
    ctx: &mut TxContext
) {
    assert!(!pool.distributed, E_ALREADY_DISTRIBUTED);
    assert!(!pool.paused, E_POOL_PAUSED);
    assert!(pm_status <= 2, E_INVALID_PM_STATUS);
    assert!(pm_status != governance::pm_status_failed(), E_PM_FAILED_ADS_DISABLED);
    assert!(option::is_some(&pool.merkle_root), E_NO_MERKLE_ROOT_SET);
    let proof_count = vector::length(&proof_hashes);
    assert!(proof_count <= MAX_BATCH_PROOFS, E_TOO_MANY_PROOFS);
    assert!(proof_count > 0, E_INVALID_MERKLE_PROOF);

    let root = option::borrow(&pool.merkle_root);
    assert!(dlux::merkle_verifier::get_leaf_count(root) >= dlux::merkle_verifier::get_threshold(root), E_THRESHOLD_NOT_MET);
    assert!(proof_count >= dlux::merkle_verifier::get_threshold(root) / 10, E_TOO_FEW_PROOFS);
    let mut pi = 0;
    while (pi < proof_count) {
        assert!(vector::length(vector::borrow(&proof_paths, pi)) <= MAX_MERKLE_PATH_DEPTH, E_PROOF_TOO_DEEP);
        pi = pi + 1;
    };
    assert!(verify_batch_ad_views(root, proof_hashes, proof_paths, proof_indices), E_INVALID_MERKLE_PROOF);

    let available_balance = balance::value(&pool.balance);
    assert!(available_balance > 0, E_INSUFFICIENT_FUNDS);

    // Read split percentages from GovernanceConfig based on PM status
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

    let foundation_share = available_balance * f_pct / 100;
    let creator_share = available_balance * c_pct / 100;
    let pm_share = available_balance * p_pct / 100;
    // Gateway share absorbs rounding dust (sent to pool.creator for now)
    let gateway_share = available_balance - foundation_share - creator_share - pm_share;

    let creator_balance = balance::split(&mut pool.balance, creator_share);
    let foundation_balance = balance::split(&mut pool.balance, foundation_share);
    let gateway_balance = balance::split(&mut pool.balance, gateway_share);
    transfer::public_transfer(coin::from_balance(creator_balance, ctx), pool.creator);
    transfer::public_transfer(coin::from_balance(foundation_balance, ctx), foundation);
    transfer::public_transfer(coin::from_balance(gateway_balance, ctx), pool.creator);

    if (pm_share > 0) {
        let pm_balance = balance::split(&mut pool.balance, pm_share);
        transfer::public_transfer(coin::from_balance(pm_balance, ctx), pm_pool);
    };

    event::emit(RevenueDistributed {
        content_id: pool.content_id,
        creator_share,
        pm_share,
        foundation_share,
    });
    pool.distributed = true;
}

/// Create location metadata
/// latitude/longitude scaled by 1e6 (e.g., 40600000 = 40.6 degrees)
/// planet: 0=Earth, 1=Moon, 2=Mars
public fun create_location_metadata(
    latitude: u64,
    longitude: u64,
    elevation: u64,
    planet: u8
): LocationMetadata {
    // Basic validation
    assert!(planet <= 2, E_INVALID_PLANET);
    
    LocationMetadata {
        latitude,
        longitude,
        elevation,
        planet,
    }
}

// ===== View functions =====

/// Get pool balance
public fun get_pool_balance(pool: &AdRevenuePool): u64 {
    balance::value(&pool.balance)
}

/// Get total revenue ever collected
public fun get_total_revenue(pool: &AdRevenuePool): u64 {
    pool.total_revenue
}

/// Check if pool has been distributed
public fun is_distributed(pool: &AdRevenuePool): bool {
    pool.distributed
}

/// Get content ID
public fun get_content_id(pool: &AdRevenuePool): vector<u8> {
    pool.content_id
}

/// Get pool creator
public fun get_creator(pool: &AdRevenuePool): address {
    pool.creator
}

/// Check if pool is paused
public fun is_paused(pool: &AdRevenuePool): bool {
    pool.paused
}

/// Whether the pool has a Merkle root set (required for distribution)
public fun has_merkle_root(pool: &AdRevenuePool): bool {
    option::is_some(&pool.merkle_root)
}

/// Merkle root hash if set; none otherwise (idiomatic Option return).
public fun get_merkle_root_hash(pool: &AdRevenuePool): Option<vector<u8>> {
    if (option::is_some(&pool.merkle_root)) {
        let root = option::borrow(&pool.merkle_root);
        let root_hash = get_root_hash(root);
        let len = vector::length(root_hash);
        let mut i = 0;
        let mut out = vector::empty<u8>();
        while (i < len) {
            vector::push_back(&mut out, *vector::borrow(root_hash, i));
            i = i + 1;
        };
        option::some(out)
    } else {
        option::none()
    }
}

// ===== Test functions =====

#[test_only]
public fun destroy_revenue_pool_for_testing(pool: AdRevenuePool, ctx: &mut TxContext) {
    let AdRevenuePool {
        id,
        content_id: _,
        creator: _,
        mut balance,
        total_revenue: _,
        distributed: _,
        merkle_root: _,
        paused: _,
        governance_config_id: _
    } = pool;
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

/// Create digital twin origin marker
public fun create_digital_twin_origin(
    gltf_index: vector<u8>,
    position_x: u64,
    position_y: u64,
    position_z: u64,
    rotation_x: u64,
    rotation_y: u64,
    rotation_z: u64,
    rotation_w: u64
): DigitalTwinOrigin {
    DigitalTwinOrigin {
        gltf_index,
        position_x,
        position_y,
        position_z,
        rotation_x,
        rotation_y,
        rotation_z,
        rotation_w,
    }
}
