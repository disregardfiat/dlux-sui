/// On-chain governance config and proposal system for DLUX.
///
/// Holds all votable parameters (PM duration, posting fee, revenue splits) in a single
/// shared GovernanceConfig object.  Off-chain, the backend determines eligible voters
/// (top-half creators + equal number of top PM earners), collects signed votes, builds a
/// Merkle tree, and calls execute_proposal with the proofs.  The contract verifies the
/// Merkle proofs, checks quorum + majority, and applies the parameter change.
///
/// Dependency: merkle_verifier (leaf module).  No imports from ad_payments, dapp_posting,
/// or metadata_pm — those modules import from governance to read config.
module dlux::governance;

use sui::event;
use sui::clock::Clock;
use dlux::merkle_verifier;

// ───── Error codes ─────

const E_INVALID_PARAM_KEY: u64 = 1;
const E_INVALID_PARAM_VALUE: u64 = 2;
const E_PROPOSAL_NOT_EXPIRED: u64 = 3;
const E_ALREADY_EXECUTED: u64 = 4;
const E_QUORUM_NOT_MET: u64 = 5;
const E_SPLITS_MUST_SUM_TO_100: u64 = 6;
const E_INVALID_PROOF: u64 = 7;
const E_INPUT_TOO_LONG: u64 = 8;
const E_YES_NOT_MAJORITY: u64 = 9;
const E_INVALID_SPLIT_COUNT: u64 = 10;
const E_TOO_MANY_PROOFS: u64 = 11;

// ───── Limits ─────

const MAX_PARAM_KEY_LEN: u64 = 64;
const MAX_VOTE_PROOFS: u64 = 200;

// ───── PM status accessors (constants are module-private in Move) ─────

/// PM is still running; creator share held in escrow, PM pool receives 40 %
public fun pm_status_active(): u8 { 0 }
/// PM resolved YES; creator keeps escrowed share, future revenue goes 10/9/81/0
public fun pm_status_passed(): u8 { 1 }
/// PM resolved NO; escrowed creator share forfeited to PM pool, ads disabled
public fun pm_status_failed(): u8 { 2 }

// ───── Structs ─────

/// Shared governance config — single source of truth for all votable parameters.
public struct GovernanceConfig has key {
    id: UID,
    /// How long the prediction market runs after a dApp is posted (ms).  Default 3 days.
    pm_duration_ms: u64,
    /// Non-storage portion of posting fee.  Total min fee = 2 × walrus_cost + votable_fee.
    votable_posting_fee: u64,
    // ── Revenue splits during PM (must sum to 100) ──
    pm_foundation_pct: u64,   // 10
    pm_gateway_pct: u64,      //  9
    pm_creator_pct: u64,      // 41  (held in escrow)
    pm_pool_pct: u64,         // 40
    // ── Revenue splits after PM success (must sum to 100) ──
    post_foundation_pct: u64, // 10
    post_gateway_pct: u64,    //  9
    post_creator_pct: u64,    // 81
    post_pm_pct: u64,         //  0
    // ── Governance meta ──
    proposal_duration_ms: u64, // How long voting window lasts (default 7 days)
    quorum_pct: u64,           // % of eligible voters needed (default 51)
    // ── Walrus bundle bounds (anti-spam: enforce proof count per drawdown) ──
    min_walrus_bundle: u64,    // Min proofs per drawdown (default 64)
    max_walrus_bundle: u64,    // Max proofs per drawdown (default 128)
    last_updated_ms: u64,
}

/// Admin capability for governance operations (held by backend / deployer).
public struct GovernanceAdminCap has key, store {
    id: UID,
}

/// Per-proposal shared object.  Created by the backend when the off-chain proposal
/// phase begins; executed after the voting window + Merkle proof submission.
public struct GovernanceProposal has key {
    id: UID,
    proposer: address,
    /// Which parameter to change.  Simple params: b"pm_duration_ms",
    /// b"votable_posting_fee", b"proposal_duration_ms", b"quorum_pct".
    /// Split params: b"pm_splits", b"post_splits" (uses split_values).
    param_key: vector<u8>,
    /// New value for simple params (ignored for split proposals).
    param_value: u64,
    /// [foundation, gateway, creator, pool] for split proposals; empty otherwise.
    split_values: vector<u64>,
    /// Merkle root of eligible voter addresses (built by backend).
    eligible_voters_root: vector<u8>,
    eligible_voter_count: u64,
    created_at_ms: u64,
    expires_at_ms: u64,
    executed: bool,
}

// ───── Events ─────

/// Emitted when a simple (non-split) parameter changes.
public struct GovernanceConfigUpdated has copy, drop {
    param_key: vector<u8>,
    old_value: u64,
    new_value: u64,
    updated_at_ms: u64,
}

/// Emitted when a split parameter changes.
public struct GovernanceSplitsUpdated has copy, drop {
    param_key: vector<u8>,
    foundation_pct: u64,
    gateway_pct: u64,
    creator_pct: u64,
    pool_pct: u64,
    updated_at_ms: u64,
}

/// Emitted when a proposal is created.
public struct ProposalCreated has copy, drop {
    proposal_id: ID,
    proposer: address,
    param_key: vector<u8>,
    param_value: u64,
    split_values: vector<u64>,
    expires_at_ms: u64,
}

/// Emitted when a proposal is executed (parameter applied).
public struct ProposalExecuted has copy, drop {
    proposal_id: ID,
    param_key: vector<u8>,
    yes_count: u64,
    no_count: u64,
}

// ───── Init ─────

fun init(ctx: &mut TxContext) {
    let admin_cap = GovernanceAdminCap { id: object::new(ctx) };
    transfer::transfer(admin_cap, ctx.sender());

    let config = GovernanceConfig {
        id: object::new(ctx),
        pm_duration_ms: 259_200_000,        // 3 days
        votable_posting_fee: 1_000_000_000,  // 1 SUI
        pm_foundation_pct: 10,
        pm_gateway_pct: 9,
        pm_creator_pct: 41,
        pm_pool_pct: 40,
        post_foundation_pct: 10,
        post_gateway_pct: 9,
        post_creator_pct: 81,
        post_pm_pct: 0,
        proposal_duration_ms: 604_800_000,   // 7 days
        quorum_pct: 51,
        min_walrus_bundle: 64,
        max_walrus_bundle: 128,
        last_updated_ms: 0,
    };
    transfer::share_object(config);
}

// ───── Reader functions (used by dapp_posting, ad_payments, metadata_pm) ─────

public fun get_pm_duration(config: &GovernanceConfig): u64 { config.pm_duration_ms }
public fun get_votable_fee(config: &GovernanceConfig): u64 { config.votable_posting_fee }

public fun get_pm_foundation_pct(config: &GovernanceConfig): u64 { config.pm_foundation_pct }
public fun get_pm_gateway_pct(config: &GovernanceConfig): u64 { config.pm_gateway_pct }
public fun get_pm_creator_pct(config: &GovernanceConfig): u64 { config.pm_creator_pct }
public fun get_pm_pool_pct(config: &GovernanceConfig): u64 { config.pm_pool_pct }

public fun get_post_foundation_pct(config: &GovernanceConfig): u64 { config.post_foundation_pct }
public fun get_post_gateway_pct(config: &GovernanceConfig): u64 { config.post_gateway_pct }
public fun get_post_creator_pct(config: &GovernanceConfig): u64 { config.post_creator_pct }
public fun get_post_pm_pct(config: &GovernanceConfig): u64 { config.post_pm_pct }

public fun get_proposal_duration(config: &GovernanceConfig): u64 { config.proposal_duration_ms }
public fun get_quorum_pct(config: &GovernanceConfig): u64 { config.quorum_pct }
public fun get_min_walrus_bundle(config: &GovernanceConfig): u64 { config.min_walrus_bundle }
public fun get_max_walrus_bundle(config: &GovernanceConfig): u64 { config.max_walrus_bundle }

// ───── Proposal lifecycle ─────

/// Backend creates a proposal after determining eligible voters and opening an
/// off-chain voting window.  The eligible_voters_root is the Merkle root of the
/// set of eligible voter addresses.
public fun create_proposal(
    config: &GovernanceConfig,
    proposer: address,
    param_key: vector<u8>,
    param_value: u64,
    split_values: vector<u64>,
    eligible_voters_root: vector<u8>,
    eligible_voter_count: u64,
    clock: &Clock,
    _admin: &GovernanceAdminCap,
    ctx: &mut TxContext,
) {
    let key_len = vector::length(&param_key);
    assert!(key_len > 0 && key_len <= MAX_PARAM_KEY_LEN, E_INPUT_TOO_LONG);

    // Validate split_values for split proposals
    if (is_splits_key(&param_key)) {
        assert!(vector::length(&split_values) == 4, E_INVALID_SPLIT_COUNT);
        let sum = *vector::borrow(&split_values, 0) + *vector::borrow(&split_values, 1)
                + *vector::borrow(&split_values, 2) + *vector::borrow(&split_values, 3);
        assert!(sum == 100, E_SPLITS_MUST_SUM_TO_100);
    };

    let now = clock.timestamp_ms();
    let expires_at_ms = now + config.proposal_duration_ms;

    let proposal_uid = object::new(ctx);
    let proposal_id = proposal_uid.to_inner();

    event::emit(ProposalCreated {
        proposal_id,
        proposer,
        param_key,
        param_value,
        split_values,
        expires_at_ms,
    });

    let proposal = GovernanceProposal {
        id: proposal_uid,
        proposer,
        param_key,
        param_value,
        split_values,
        eligible_voters_root,
        eligible_voter_count,
        created_at_ms: now,
        expires_at_ms,
        executed: false,
    };
    transfer::share_object(proposal);
}

/// Backend submits Merkle proofs of votes.  The vote Merkle tree is built off-chain;
/// each leaf = keccak256(voter_address || vote_direction).  The contract verifies a
/// sample of proofs, checks quorum + YES majority, then applies the config change.
public fun execute_proposal(
    config: &mut GovernanceConfig,
    proposal: &mut GovernanceProposal,
    vote_root_hash: vector<u8>,
    proof_hashes: vector<vector<u8>>,
    proof_paths: vector<vector<vector<u8>>>,
    proof_indices: vector<vector<u8>>,
    yes_count: u64,
    no_count: u64,
    clock: &Clock,
    _admin: &GovernanceAdminCap,
) {
    assert!(!proposal.executed, E_ALREADY_EXECUTED);
    let now = clock.timestamp_ms();
    assert!(now >= proposal.expires_at_ms, E_PROPOSAL_NOT_EXPIRED);

    // Quorum check: total votes must be ≥ quorum % of eligible voters
    let total_votes = yes_count + no_count;
    let quorum_needed = (proposal.eligible_voter_count * config.quorum_pct) / 100;
    assert!(total_votes >= quorum_needed, E_QUORUM_NOT_MET);
    assert!(yes_count > no_count, E_YES_NOT_MAJORITY);

    // Verify vote Merkle proofs (reuses merkle_verifier pattern)
    let proof_count = vector::length(&proof_hashes);
    assert!(proof_count > 0, E_INVALID_PROOF);
    assert!(proof_count <= MAX_VOTE_PROOFS, E_TOO_MANY_PROOFS);

    // Build content_id from param_key (copy because proposal.param_key is borrowed)
    let mut content_id = vector::empty<u8>();
    let key_len = vector::length(&proposal.param_key);
    let mut ki = 0;
    while (ki < key_len) {
        vector::push_back(&mut content_id, *vector::borrow(&proposal.param_key, ki));
        ki = ki + 1;
    };

    let vote_root = merkle_verifier::create_merkle_root(
        content_id,
        vote_root_hash,
        total_votes,
        quorum_needed,
    );
    assert!(
        merkle_verifier::verify_batch_ad_views(&vote_root, proof_hashes, proof_paths, proof_indices),
        E_INVALID_PROOF,
    );

    // Apply the parameter change
    apply_param(config, &proposal.param_key, proposal.param_value, &proposal.split_values, now);

    proposal.executed = true;

    event::emit(ProposalExecuted {
        proposal_id: object::id(proposal),
        param_key: proposal.param_key,
        yes_count,
        no_count,
    });
}

// ───── Internal helpers ─────

/// Apply a single parameter change to the config.
fun apply_param(
    config: &mut GovernanceConfig,
    param_key: &vector<u8>,
    param_value: u64,
    split_values: &vector<u64>,
    now_ms: u64,
) {
    if (*param_key == b"pm_duration_ms") {
        let old = config.pm_duration_ms;
        config.pm_duration_ms = param_value;
        emit_config_updated(*param_key, old, param_value, now_ms);
    } else if (*param_key == b"votable_posting_fee") {
        let old = config.votable_posting_fee;
        config.votable_posting_fee = param_value;
        emit_config_updated(*param_key, old, param_value, now_ms);
    } else if (*param_key == b"proposal_duration_ms") {
        let old = config.proposal_duration_ms;
        config.proposal_duration_ms = param_value;
        emit_config_updated(*param_key, old, param_value, now_ms);
    } else if (*param_key == b"quorum_pct") {
        assert!(param_value > 0 && param_value <= 100, E_INVALID_PARAM_VALUE);
        let old = config.quorum_pct;
        config.quorum_pct = param_value;
        emit_config_updated(*param_key, old, param_value, now_ms);
    } else if (*param_key == b"min_walrus_bundle") {
        let old = config.min_walrus_bundle;
        config.min_walrus_bundle = param_value;
        emit_config_updated(*param_key, old, param_value, now_ms);
    } else if (*param_key == b"max_walrus_bundle") {
        assert!(param_value >= config.min_walrus_bundle, E_INVALID_PARAM_VALUE);
        let old = config.max_walrus_bundle;
        config.max_walrus_bundle = param_value;
        emit_config_updated(*param_key, old, param_value, now_ms);
    } else if (*param_key == b"pm_splits") {
        assert!(vector::length(split_values) == 4, E_INVALID_SPLIT_COUNT);
        config.pm_foundation_pct = *vector::borrow(split_values, 0);
        config.pm_gateway_pct    = *vector::borrow(split_values, 1);
        config.pm_creator_pct    = *vector::borrow(split_values, 2);
        config.pm_pool_pct       = *vector::borrow(split_values, 3);
        emit_splits_updated(*param_key, config.pm_foundation_pct, config.pm_gateway_pct,
                            config.pm_creator_pct, config.pm_pool_pct, now_ms);
    } else if (*param_key == b"post_splits") {
        assert!(vector::length(split_values) == 4, E_INVALID_SPLIT_COUNT);
        config.post_foundation_pct = *vector::borrow(split_values, 0);
        config.post_gateway_pct    = *vector::borrow(split_values, 1);
        config.post_creator_pct    = *vector::borrow(split_values, 2);
        config.post_pm_pct         = *vector::borrow(split_values, 3);
        emit_splits_updated(*param_key, config.post_foundation_pct, config.post_gateway_pct,
                            config.post_creator_pct, config.post_pm_pct, now_ms);
    } else {
        abort E_INVALID_PARAM_KEY
    };
    config.last_updated_ms = now_ms;
}

fun is_splits_key(key: &vector<u8>): bool {
    *key == b"pm_splits" || *key == b"post_splits"
}

fun emit_config_updated(param_key: vector<u8>, old_value: u64, new_value: u64, ts: u64) {
    event::emit(GovernanceConfigUpdated { param_key, old_value, new_value, updated_at_ms: ts });
}

fun emit_splits_updated(
    param_key: vector<u8>,
    foundation_pct: u64, gateway_pct: u64, creator_pct: u64, pool_pct: u64,
    ts: u64,
) {
    event::emit(GovernanceSplitsUpdated {
        param_key, foundation_pct, gateway_pct, creator_pct, pool_pct, updated_at_ms: ts,
    });
}

// ───── Test helpers ─────

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
/// Governance config with relaxed walrus bundle bounds (min=1, max=128) for tests that use small proof counts.
public fun create_governance_config_for_walrus_testing(ctx: &mut TxContext): GovernanceConfig {
    GovernanceConfig {
        id: object::new(ctx),
        pm_duration_ms: 259_200_000,
        votable_posting_fee: 1_000_000_000,
        pm_foundation_pct: 10,
        pm_gateway_pct: 9,
        pm_creator_pct: 41,
        pm_pool_pct: 40,
        post_foundation_pct: 10,
        post_gateway_pct: 9,
        post_creator_pct: 81,
        post_pm_pct: 0,
        proposal_duration_ms: 604_800_000,
        quorum_pct: 51,
        min_walrus_bundle: 1,
        max_walrus_bundle: 128,
        last_updated_ms: 0,
    }
}

#[test_only]
public fun create_governance_config_for_testing(ctx: &mut TxContext): GovernanceConfig {
    GovernanceConfig {
        id: object::new(ctx),
        pm_duration_ms: 259_200_000,
        votable_posting_fee: 1_000_000_000,
        pm_foundation_pct: 10,
        pm_gateway_pct: 9,
        pm_creator_pct: 41,
        pm_pool_pct: 40,
        post_foundation_pct: 10,
        post_gateway_pct: 9,
        post_creator_pct: 81,
        post_pm_pct: 0,
        proposal_duration_ms: 604_800_000,
        quorum_pct: 51,
        min_walrus_bundle: 64,
        max_walrus_bundle: 128,
        last_updated_ms: 0,
    }
}

#[test_only]
public fun destroy_governance_config_for_testing(config: GovernanceConfig) {
    let GovernanceConfig {
        id,
        pm_duration_ms: _, votable_posting_fee: _,
        pm_foundation_pct: _, pm_gateway_pct: _, pm_creator_pct: _, pm_pool_pct: _,
        post_foundation_pct: _, post_gateway_pct: _, post_creator_pct: _, post_pm_pct: _,
        proposal_duration_ms: _, quorum_pct: _, min_walrus_bundle: _, max_walrus_bundle: _, last_updated_ms: _,
    } = config;
    object::delete(id);
}

#[test_only]
public fun create_governance_admin_cap_for_testing(ctx: &mut TxContext): GovernanceAdminCap {
    GovernanceAdminCap { id: object::new(ctx) }
}

#[test_only]
public fun destroy_governance_admin_cap_for_testing(cap: GovernanceAdminCap) {
    let GovernanceAdminCap { id } = cap;
    object::delete(id);
}

#[test_only]
public fun destroy_governance_proposal_for_testing(proposal: GovernanceProposal) {
    let GovernanceProposal {
        id, proposer: _, param_key: _, param_value: _, split_values: _,
        eligible_voters_root: _, eligible_voter_count: _,
        created_at_ms: _, expires_at_ms: _, executed: _,
    } = proposal;
    object::delete(id);
}
