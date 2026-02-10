pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Merkle tree inclusion proof verification
// Proves that a leaf is in a Merkle tree without revealing the tree structure
template MerkleProof(levels) {
    signal input leaf; // ZK proof hash (no identity)
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input root; // Merkle root
    
    signal output isValid;
    
    // Build Merkle path from leaf to root
    component hashers[levels];
    component muxes[levels];
    
    var currentHash = leaf;
    
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        muxes[i] = MultiMux1(2);
        
        // Hash left and right children
        muxes[i].c[0][0] <== currentHash;
        muxes[i].c[0][1] <== pathElements[i];
        muxes[i].c[1][0] <== pathElements[i];
        muxes[i].c[1][1] <== currentHash;
        
        muxes[i].s <== pathIndices[i];
        
        hashers[i].inputs[0] <== muxes[i].out[0];
        hashers[i].inputs[1] <== muxes[i].out[1];
        
        currentHash = hashers[i].out;
    }
    
    // Verify computed root matches provided root
    component eq = IsEqual();
    currentHash --> eq.in[0];
    root --> eq.in[1];
    
    eq.out --> isValid;
}

// MultiMux1: Multiplexer for Merkle tree path selection
template MultiMux1(n) {
    signal input c[n][2];
    signal input s;
    signal output out[2];
    
    component muxes[n];
    
    for (var i = 0; i < n; i++) {
        muxes[i] = Mux1();
        c[i][0] --> muxes[i].c[0];
        c[i][1] --> muxes[i].c[1];
        s --> muxes[i].s;
        muxes[i].out --> out[i];
    }
}

// Mux1: Simple 2-to-1 multiplexer
template Mux1() {
    signal input c[2];
    signal input s;
    signal output out;
    
    // out = s ? c[1] : c[0]
    // out = c[0] + s*(c[1] - c[0])
    out <== c[0] + s*(c[1] - c[0]);
}

component main = MerkleProof(10); // 10 levels = 2^10 = 1024 leaves max
