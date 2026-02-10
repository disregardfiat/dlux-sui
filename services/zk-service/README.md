# ZK Service

Zero-knowledge proof generation and verification service for privacy-preserving ad verification.

## Overview

This service provides:
- **ZK Proof Generation**: Generate zkSNARK proofs for ad views without revealing viewer identity
- **Homomorphic Encryption**: Encrypt impression data for privacy-preserving aggregate statistics
- **Proof Verification**: Verify ZK proofs and Merkle tree inclusion proofs

## Features

- **Privacy-Preserving**: Viewer identity is used to generate proofs but NOT included in proof output
- **Homomorphic Aggregation**: Compute aggregate statistics on encrypted data
- **Merkle Tree Support**: Build and verify Merkle trees for batch proof verification

## Setup

### Install Dependencies

```bash
npm install
```

### Compile Circuits

Before using the service, you need to compile the Circom circuits:

```bash
# Install circom (if not already installed)
npm install -g circom

# Compile circuits
npm run compile-circuits
```

This will generate:
- `circuits/ad-view-proof.wasm` - Compiled circuit
- `circuits/ad-view-proof.zkey` - Trusted setup key (requires trusted setup ceremony)

### Generate Encryption Keys

```bash
# Generate homomorphic encryption keys
node scripts/generate-keys.js
```

Add the output to your `.env` file:
```
HOMOMORPHIC_PUBLIC_KEY=<generated_public_key>
HOMOMORPHIC_PRIVATE_KEY=<generated_private_key>
```

## Environment Variables

See `env.example` for all configuration options.

## API Endpoints

### POST /proofs/generate
Generate ZK proof for ad events (view/click/conversion).

**Request:**
```json
{
  "adId": "ad_123",
  "viewerIdentity": "suiNS_name_or_address",
  "contentId": "content_456",
  "blockHeader": "block_header_hash",
  "secretSalt": "random_salt",
  "merkleRoot": "0",
  "threshold": 100,
  "actionType": "view"
}
### POST /proofs/generate-click
Generate ZK proof for ad click.

### POST /proofs/generate-conversion
Generate ZK proof for ad conversion.
```

**Response:**
```json
{
  "proof": {...},
  "publicSignals": ["..."],
  "proofHash": "hash_of_proof",
  "encryptedViewer": "encrypted_viewer_identity"
}
```

### POST /proofs/verify
Verify ZK proof.

**Request:**
```json
{
  "proof": {...},
  "publicSignals": ["..."]
}
```

**Response:**
```json
{
  "valid": true
}
```

### POST /proofs/aggregate
Aggregate encrypted impressions (homomorphic addition).

**Request:**
```json
{
  "encryptedImpressions": ["encrypted1", "encrypted2", ...]
}
```

**Response:**
```json
{
  "encryptedAggregate": "aggregated_encrypted_value"
}
```

### POST /proofs/decrypt-aggregate
Decrypt aggregate (admin only).

**Request:**
```json
{
  "encryptedAggregate": "encrypted_value"
}
```

**Headers:**
```
X-Admin-Key: <admin_key>
```

**Response:**
```json
{
  "count": 150
}
```

## Privacy Guarantees

1. **Viewer Identity Hidden**: ZK proofs prove ad view without revealing who viewed
2. **Content Pairing Encrypted**: Ad-content relationships stored homomorphically encrypted
3. **Aggregate Statistics**: Computed on encrypted data, only decrypted by admin
4. **Merkle Proofs**: Batch verification without exposing individual proofs

## Development

```bash
# Development mode
npm run dev

# Build
npm run build

# Test
npm test
```

## Architecture

- **Circom Circuits**: ZK circuit definitions in `circuits/`
- **Proof Generator**: Generates zkSNARK proofs using snarkjs
- **Homomorphic Encryption**: Paillier cryptosystem for additive homomorphic operations
- **Merkle Trees**: Built in DGraph service, verified here

## Notes

- Circuit compilation requires Circom compiler
- Trusted setup (zkey generation) requires a trusted setup ceremony
- For production, use proper key management for homomorphic encryption keys
