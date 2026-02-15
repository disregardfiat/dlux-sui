/// Admin override system for prediction market moderation and trusted badge.
///
/// AdminSet holds the set of admins (multisig-style), fee config, and fee balance.
/// AdminOverrideCap authorizes an admin to force-resolve a market to NO (veto only).
/// Fee (2–5% of PM ad revenue) is taken on override and sent to AdminSet.fee_balance.
module dlux::admin;

use sui::event;
use sui::balance::{Self, Balance};
use sui::sui::SUI;
use sui::object::{Self, ID, UID};
use sui::table::{Self, Table};
use dlux::governance::GovernanceAdminCap;

// ───── Error codes ─────

const E_INVALID_FEE_PCT: u64 = 4;

// ───── Structs ─────

/// Holds admin set, fee config, and collected override fees.
/// Used for moderation: admins can force-resolve markets to NO (veto power only).
/// Any single admin with AdminOverrideCap can override; threshold reserved for future multi-admin quorum.
public struct AdminSet has key {
    id: UID,
    admins: Table<address, bool>,
    fee_pct: u64,
    fee_balance: Balance<SUI>,
    governance_config_id: ID,
}

/// Cap held by each admin; required to call admin_resolve_override.
/// Verified against AdminSet at call time.
public struct AdminOverrideCap has key, store {
    id: UID,
    admin_set_id: ID,
}

// ───── Events ─────

/// Emitted when an admin force-resolves a market to NO (veto).
public struct AdminOverride has copy, drop {
    market_id: ID,
    admin: address,
    fee_taken: u64,
}

/// Emitted when admin is added to AdminSet.
public struct AdminAdded has copy, drop {
    admin: address,
}

/// Emitted when admin is removed from AdminSet.
public struct AdminRemoved has copy, drop {
    admin: address,
}

// ───── Init / Creation ─────

/// Create AdminSet (called from init or governance). Not in init by default to allow
/// governance to configure governance_config_id first.
public fun create_admin_set(
    fee_pct: u64,
    governance_config_id: ID,
    ctx: &mut TxContext,
): AdminSet {
    assert!(fee_pct >= 2 && fee_pct <= 5, E_INVALID_FEE_PCT);
    AdminSet {
        id: object::new(ctx),
        admins: table::new(ctx),
        fee_pct,
        fee_balance: balance::zero(),
        governance_config_id,
    }
}

/// Add AdminOverrideCap for a new admin. Call add_admin first, then give cap to admin.
public fun create_admin_override_cap(
    admin_set: &AdminSet,
    _governance_cap: &GovernanceAdminCap,
    ctx: &mut TxContext,
): AdminOverrideCap {
    AdminOverrideCap {
        id: object::new(ctx),
        admin_set_id: object::id(admin_set),
    }
}

// ───── Admin management (governance) ─────

/// Add admin to the set. Requires GovernanceAdminCap.
public fun add_admin(
    admin_set: &mut AdminSet,
    admin: address,
    _governance_cap: &GovernanceAdminCap,
) {
    if (!table::contains(&admin_set.admins, admin)) {
        table::add(&mut admin_set.admins, admin, true);
        event::emit(AdminAdded { admin });
    };
}

/// Remove admin from the set.
public fun remove_admin(
    admin_set: &mut AdminSet,
    admin: address,
    _governance_cap: &GovernanceAdminCap,
) {
    if (table::contains(&admin_set.admins, admin)) {
        table::remove(&mut admin_set.admins, admin);
        event::emit(AdminRemoved { admin });
    };
}

// ───── Verification ─────

/// Check if address is an admin. Used by prediction_market::admin_resolve_override.
public fun is_admin(admin_set: &AdminSet, addr: address): bool {
    table::contains(&admin_set.admins, addr)
}

/// Get fee percentage for override.
public fun get_fee_pct(admin_set: &AdminSet): u64 {
    admin_set.fee_pct
}

/// Record override: deposit fee and emit AdminOverride event. Called by prediction_market.
public fun record_override(
    admin_set: &mut AdminSet,
    market_id: ID,
    admin: address,
    fee: Balance<SUI>,
) {
    let fee_val = balance::value(&fee);
    balance::join(&mut admin_set.fee_balance, fee);
    event::emit(AdminOverride { market_id, admin, fee_taken: fee_val });
}

/// Verify cap matches AdminSet.
public fun cap_matches_admin_set(cap: &AdminOverrideCap, admin_set: &AdminSet): bool {
    object::id(admin_set) == cap.admin_set_id
}

// ───── Getters ─────

public fun get_fee_balance(admin_set: &AdminSet): u64 {
    balance::value(&admin_set.fee_balance)
}
