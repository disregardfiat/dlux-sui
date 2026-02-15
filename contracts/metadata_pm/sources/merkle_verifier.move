/// Shared Merkle verification for ad views (used by metadata_pm and ad_payments).
/// Breaks cycle: ad_payments can call verify_batch_ad_views without depending on metadata_pm.
module dlux::merkle_verifier;

use sui::hash;

/// Max proofs per batch (DoS / gas cap)
const MAX_BATCH_PROOFS: u64 = 100;
/// Max Merkle path depth (gas / DoS)
const MAX_MERKLE_PATH_DEPTH: u64 = 40;

const E_INVALID_THRESHOLD: u64 = 1;

/// Merkle root for batch verification of ad impressions
public struct MerkleRoot has store, drop {
    content_id: vector<u8>,
    root_hash: vector<u8>,
    leaf_count: u64,
    threshold: u64,
}

/// Getters for use by metadata_pm and other modules
public fun get_content_id(root: &MerkleRoot): &vector<u8> { &root.content_id }
public fun get_root_hash(root: &MerkleRoot): &vector<u8> { &root.root_hash }
public fun get_leaf_count(root: &MerkleRoot): u64 { root.leaf_count }
public fun get_threshold(root: &MerkleRoot): u64 { root.threshold }

/// Verify Merkle inclusion proof (SHA3-256)
/// path: sibling hashes leaf→root; indices: left(0)/right(1) per level
public fun verify_merkle_inclusion(
    leaf: vector<u8>,
    path: vector<vector<u8>>,
    indices: vector<u8>,
    root: vector<u8>
): bool {
    let path_len = vector::length(&path);
    let indices_len = vector::length(&indices);
    if (path_len == 0 || indices_len == 0 || path_len != indices_len) {
        return false
    };
    let mut current_hash = hash::keccak256(&leaf);
    let mut i = 0;
    while (i < path_len) {
        let sibling = *vector::borrow(&path, i);
        let index = *vector::borrow(&indices, i);
        let mut parent_input = vector::empty<u8>();
        if (index == 0) {
            vector::append(&mut parent_input, current_hash);
            vector::append(&mut parent_input, sibling);
        } else {
            vector::append(&mut parent_input, sibling);
            vector::append(&mut parent_input, current_hash);
        };
        current_hash = hash::keccak256(&parent_input);
        i = i + 1;
    };
    if (vector::length(&current_hash) != vector::length(&root)) {
        return false
    };
    let mut j = 0;
    let hash_len = vector::length(&current_hash);
    while (j < hash_len) {
        if (*vector::borrow(&current_hash, j) != *vector::borrow(&root, j)) {
            return false
        };
        j = j + 1;
    };
    true
}

/// Create Merkle root for batch verification
public fun create_merkle_root(
    content_id: vector<u8>,
    root_hash: vector<u8>,
    leaf_count: u64,
    threshold: u64
): MerkleRoot {
    assert!(threshold <= leaf_count, E_INVALID_THRESHOLD);
    MerkleRoot {
        content_id,
        root_hash,
        leaf_count,
        threshold,
    }
}

/// Verify batch of ad views using Merkle root
public fun verify_batch_ad_views(
    merkle_root: &MerkleRoot,
    proof_hashes: vector<vector<u8>>,
    proof_paths: vector<vector<vector<u8>>>,
    proof_indices: vector<vector<u8>>
): bool {
    if (merkle_root.leaf_count < merkle_root.threshold) {
        return false
    };
    let proof_count = vector::length(&proof_hashes);
    if (proof_count > MAX_BATCH_PROOFS) {
        return false
    };
    let mut i = 0;
    while (i < proof_count) {
        let path = *vector::borrow(&proof_paths, i);
        if (vector::length(&path) > MAX_MERKLE_PATH_DEPTH) {
            return false
        };
        let leaf = *vector::borrow(&proof_hashes, i);
        let indices = *vector::borrow(&proof_indices, i);
        if (!verify_merkle_inclusion(leaf, path, indices, merkle_root.root_hash)) {
            return false
        };
        i = i + 1;
    };
    true
}

// ───── Governance vote verification (same algorithm, distinct semantic type) ─────

/// Merkle root for batch verification of governance votes.
/// Leaf = keccak256(voter_address || vote_direction).
/// The underlying verification is identical to ad impressions; this struct
/// provides semantic clarity and a distinct type for governance proofs.
public struct VoteProofRoot has store, drop {
    proposal_id: vector<u8>,
    root_hash: vector<u8>,
    voter_count: u64,
    quorum: u64,
}

/// Create a VoteProofRoot for governance vote verification.
public fun create_vote_proof_root(
    proposal_id: vector<u8>,
    root_hash: vector<u8>,
    voter_count: u64,
    quorum: u64,
): VoteProofRoot {
    assert!(quorum <= voter_count, E_INVALID_THRESHOLD);
    VoteProofRoot { proposal_id, root_hash, voter_count, quorum }
}

/// Verify batch of governance votes (delegates to the same Merkle inclusion logic).
public fun verify_batch_votes(
    vote_root: &VoteProofRoot,
    proof_hashes: vector<vector<u8>>,
    proof_paths: vector<vector<vector<u8>>>,
    proof_indices: vector<vector<u8>>,
): bool {
    if (vote_root.voter_count < vote_root.quorum) {
        return false
    };
    let proof_count = vector::length(&proof_hashes);
    if (proof_count > MAX_BATCH_PROOFS) {
        return false
    };
    let mut i = 0;
    while (i < proof_count) {
        let path = *vector::borrow(&proof_paths, i);
        if (vector::length(&path) > MAX_MERKLE_PATH_DEPTH) {
            return false
        };
        let leaf = *vector::borrow(&proof_hashes, i);
        let indices = *vector::borrow(&proof_indices, i);
        if (!verify_merkle_inclusion(leaf, path, indices, vote_root.root_hash)) {
            return false
        };
        i = i + 1;
    };
    true
}

/// Getters for VoteProofRoot
public fun get_vote_proposal_id(root: &VoteProofRoot): &vector<u8> { &root.proposal_id }
public fun get_vote_root_hash(root: &VoteProofRoot): &vector<u8> { &root.root_hash }
public fun get_voter_count(root: &VoteProofRoot): u64 { root.voter_count }
public fun get_quorum(root: &VoteProofRoot): u64 { root.quorum }

#[test_only]
public fun destroy_merkle_root(merkle_root: MerkleRoot) {
    let MerkleRoot { content_id: _, root_hash: _, leaf_count: _, threshold: _ } = merkle_root;
}

#[test_only]
public fun create_merkle_root_for_testing(
    content_id: vector<u8>,
    root_hash: vector<u8>,
    leaf_count: u64,
    threshold: u64
): MerkleRoot {
    MerkleRoot { content_id, root_hash, leaf_count, threshold }
}

#[test_only]
public fun destroy_vote_proof_root(root: VoteProofRoot) {
    let VoteProofRoot { proposal_id: _, root_hash: _, voter_count: _, quorum: _ } = root;
}
