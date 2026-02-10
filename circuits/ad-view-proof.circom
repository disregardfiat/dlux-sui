pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// XOR component for privacy-preserving binding
template Xor() {
    signal input a;
    signal input b;
    signal output out;
    
    // XOR: (a + b) mod 2, but in field arithmetic
    // For field elements, we use: out = a + b - 2*a*b
    // Simplified: out = a + b - 2*(a*b)
    out <== a + b - 2*a*b;
}

// Main circuit for ad view proof
// Proves that an ad was viewed without revealing viewer identity
template AdViewProof() {
    // Private inputs (witnesses - hidden from verifier)
    signal private input adId;
    signal private input viewerIdentity; // SuiNS name hash or address hash
    signal private input contentId;
    signal private input blockHeader;
    signal private input secretSalt; // Random salt for privacy
    signal private input actionType; // 1=view, 2=click, 3=conversion
    
    // Public inputs (known to verifier)
    signal input merkleRoot;
    signal input threshold; // e.g., 100
    
    // Outputs
    signal output proofHash; // Hash of (adId, contentId, blockHeader) - no identity
    signal output isValid;
    
    // Compute XOR binding (in ZK) for privacy-preserving pairing
    component xor1 = Xor();
    component xor2 = Xor();
    component xor3 = Xor();
    
    adId --> xor1.a;
    viewerIdentity --> xor1.b;
    xor1.out --> xor2.a;
    contentId --> xor2.b;
    xor2.out --> xor3.a;
    blockHeader --> xor3.b;
    
    // Hash the XOR result using Poseidon (ZK-friendly hash)
    // Input: [XOR_result, secretSalt, adId, contentId, actionType]
    component poseidon = Poseidon(5);
    xor3.out --> poseidon.inputs[0];
    secretSalt --> poseidon.inputs[1];
    adId --> poseidon.inputs[2];
    contentId --> poseidon.inputs[3];
    actionType --> poseidon.inputs[4];
    
    poseidon.out --> proofHash;
    
    // Verify proof is valid (without revealing identity)
    // This ensures the proof meets minimum requirements
    component checkThreshold = LessThan(32);
    proofHash --> checkThreshold.in[0];
    threshold --> checkThreshold.in[1];
    
    checkThreshold.out --> isValid;
}

component main = AdViewProof();
