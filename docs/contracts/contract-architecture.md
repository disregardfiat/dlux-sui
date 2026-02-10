# DLUX Ad Network Smart Contracts Architecture

## Overview

The DLUX Ad Network is powered by a suite of Sui Move smart contracts that handle ad campaigns, payments, tracking, and revenue distribution. These contracts are designed to be privacy-preserving, using Zero-Knowledge proofs and Merkle trees for verification.

## Contract Package

**Package Name:** `dlux_metadata_pm`  
**Location:** `contracts/metadata_pm/`

## Contracts

### 1. Ad Campaigns (`ad_campaigns.move`)

Manages the lifecycle of advertising campaigns including creation, updates, pausing, and budget management.

**Key Features:**
- Campaign creation with SUI payment (properly escrowed, not frozen)
- Campaign status management (active, paused, cancelled, expired, depleted)
- Impression cost deduction with automatic budget tracking
- Advertiser-only access control for modifications
- **GeoIP targeting** via `user_zones` (e.g., ["US", "EU", "ASIA"])
- **Content zone targeting** via `content_zones`
- **Digital twin support** via `planet` field (0=Earth, 1=Moon, 2=Mars)
- **Escrow integration** - funds properly escrowed in `CampaignEscrow`

[Full API Documentation](./ad-campaigns-api.md)

### 2. Ad Payments (`ad_payments.move`)

Handles the financial aspects of ad campaigns including escrow, revenue pooling, and distribution.

**Key Features:**
- Campaign escrow for holding advertiser funds
- Revenue pool for aggregating impression payments
- Revenue distribution following the DLUX model (50% creator, 30% foundation, 20% PM)
- Lock periods for refund eligibility

[Full API Documentation](./ad-payments-api.md)

### 3. Ad Tracking (`ad_tracking.move`)

Provides privacy-preserving click and conversion tracking using anonymous tokens.

**Key Features:**
- Anonymous click token generation
- Click token verification with expiration
- Conversion recording and verification
- Privacy-preserving (tokens don't reveal user identity)

[Full API Documentation](./ad-tracking-api.md)

### 4. dApp Posting (`dapp_posting.move`)

On-chain dApp submission with posting fee and event emission for indexer/DGraph.

**Key Features:**
- Accepts dApp metadata (name, description, permlink, version, manifest, blobIds, tags, category)
- Requires minimum posting fee (0.001 SUI)
- Emits `DappPosted` event for sui-service indexer
- Emits `PredictionMarketTriggered` event (50% of fee to PM pool)
- Posting fee pool collects fees; admin can withdraw

### 5. Metadata PM (`metadata_pm.move`)

Core contract for ZK proof verification, Merkle tree batch verification, and location/digital twin metadata.

**Key Features:**
- ZK proof verification (placeholder for on-chain verifier)
- Merkle inclusion proofs for batch verification
- Ad revenue pool creation and management
- Threshold-based revenue distribution
- **Location metadata** with latitude, longitude, elevation, and planet
- **Digital twin origin markers** with GLTF index and 6DOF pose (position + rotation quaternion)

## Contract Interactions

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ADVERTISER                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Creates campaign + funds escrow
                                    ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Ad Campaigns      │◄────│   Ad Payments       │     │   Ad Tracking       │
│                     │     │                     │     │                     │
│ • Create campaign   │     │ • Create escrow     │     │ • Create click token│
│ • Pause/resume      │     │ • Add funds         │     │ • Verify token      │
│ • Deduct impression │     │ • Withdraw for imp. │     │ • Record conversion │
│ • Cancel + refund   │     │ • Refund escrow     │     │ • Verify conversion │
└─────────────────────┘     │ • Distribute revenue│     └─────────────────────┘
                            └─────────────────────┘
                                    │
                                    │ Funds flow to
                                    ▼
                            ┌─────────────────────┐
                            │   Revenue Pool      │
                            │                     │
                            │ Collects impression │
                            │ revenue for batch   │
                            │ distribution        │
                            └─────────────────────┘
                                    │
                                    │ Batch verification
                                    ▼
                            ┌─────────────────────┐
                            │   Metadata PM       │
                            │                     │
                            │ • ZK proof verify   │
                            │ • Merkle inclusion  │
                            │ • Revenue distribute│
                            └─────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Creator  │   │ Foundation│   │  PM Pool  │
            │   (50%)   │   │   (30%)   │   │   (20%)   │
            └───────────┘   └───────────┘   └───────────┘
```

## Data Flow

### Campaign Creation Flow

1. Advertiser calls `create_campaign()` with SUI payment
2. Campaign is created with shared object access
3. Payment is frozen as campaign escrow
4. Campaign is active and ready for impressions

### Impression Verification Flow

1. User views ad, client generates ZK proof
2. Proof submitted to off-chain service (DGraph)
3. Proofs aggregated into Merkle tree
4. When threshold reached, `deduct_impression_cost()` called
5. Funds move from campaign to revenue pool

### Revenue Distribution Flow

1. Revenue pool accumulates from impressions
2. When distribution triggered, `distribute_revenue()` called
3. Funds split: 50% creator, 30% foundation, 20% PM pool
4. Events emitted for tracking

### Click/Conversion Tracking Flow

1. User clicks ad, `create_click_token()` generates anonymous token
2. Token hash stored in registry
3. On conversion, `record_conversion()` links click to conversion
4. Conversion verified with `verify_conversion()`
5. All tracking is anonymous (hash-based)

## Security Model

### Access Control

- **Advertiser**: Can create/update/pause/cancel their campaigns
- **AdminCap**: Required for revenue distribution and escrow operations
- **VerifierCap**: Required for conversion verification

### Privacy Guarantees

- Click tokens use SHA3-256 hashing - no user identity stored
- ZK proofs verify ad views without revealing viewer
- Merkle trees batch verify without individual attribution
- Conversions linked by hash, not user ID

### Error Handling

All contracts use explicit error codes:

| Error Code | Contract | Meaning |
|------------|----------|---------|
| 1 | campaigns | E_NOT_ADVERTISER |
| 1 | payments | E_NOT_CAMPAIGN_OWNER |
| 1 | tracking | E_TOKEN_EXPIRED |
| 1 | metadata | E_INVALID_ZK_PROOF |
| 2 | payments | E_ESCROW_LOCKED |
| 2 | tracking | E_INVALID_TOKEN |
| 3 | metadata | E_THRESHOLD_NOT_MET |
| 3 | payments | E_INSUFFICIENT_FUNDS |
| 3 | tracking | E_TOKEN_ALREADY_USED |
| 4 | metadata | E_ALREADY_DISTRIBUTED |
| 4 | campaigns | E_INSUFFICIENT_BUDGET |

## Events

All state changes emit events for off-chain indexing:

### Campaign Events
- `CampaignCreated`
- `CampaignUpdated`
- `CampaignStatusChanged`
- `ImpressionRecorded`
- `CampaignCancelled`

### Payment Events
- `EscrowCreated`
- `FundsWithdrawn`
- `EscrowRefunded`
- `TransferredToPool`
- `RevenueDistributed`

### Tracking Events
- `ClickTokenCreated`
- `TokenVerified`
- `ConversionRecorded`
- `ConversionVerified`

### dApp Posting Events
- `DappPosted` – dApp posted on-chain (id, name, owner, permlink, manifest, blobIds, tags, postingFee, timestamp)
- `PredictionMarketTriggered` – PM creation triggered (dapp_id, posting_fee_contribution, triggered_by)

### Metadata Events
- `ZKProofVerified`
- `RevenueDistributed`

## Development

### Build Contracts

```bash
cd contracts/metadata_pm
sui move build
```

### Run Tests

```bash
sui move test
```

### Test Coverage

- `metadata_pm_tests.move`: 13 tests
- `ad_campaigns_tests.move`: 12 tests
- `ad_payments_tests.move`: 6 tests
- `ad_tracking_tests.move`: 8 tests
- `dapp_posting_tests.move`: 5 tests
- **Total: 44+ tests**

### Deploy to Testnet

```bash
sui client publish --gas-budget 100000000
```

## Integration Points

### Off-Chain Services

| Service | Integration |
|---------|-------------|
| sui-service | Campaign management, payment processing |
| dgraph-service | Event indexing, impression aggregation |
| zk-service | Proof generation and verification |
| walrus-service | Click tracking, conversion gateway |

### Frontend

| Component | Contract Interaction |
|-----------|---------------------|
| Ad Dashboard | Campaign CRUD via sui-service |
| Wallet | Payment + escrow via sui-service |
| Analytics | Events indexed by dgraph-service |

## Future Enhancements

1. **On-Chain ZK Verifier**: Replace placeholder with actual Groth16 verifier
2. **Merkle Tree Verification**: Implement full Merkle proof verification
3. **Token Transfers**: Complete SUI token transfer implementation
4. **Multi-Currency**: Support for stablecoins and other tokens
5. **Governance**: DAO-based parameter updates
