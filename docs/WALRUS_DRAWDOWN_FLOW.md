# Walrus Node Drawdown Flow

## Overview

This document describes how decentralized Walrus nodes serve content, collect verified signatures (ads/subscriber passes), and draw down from the ad revenue pool with the correct incentive structure.

## Architecture

**Decentralized Walrus Network:**
- Multiple Walrus nodes serve content from Walrus storage
- Nodes collect signatures/proofs of ads viewed or subscriber passes
- Nodes can draw down from the ad revenue pool based on verified signatures
- Revenue split incentivizes truth-seeking through prediction markets

## Revenue Split (Walrus Drawdown)

When a Walrus node draws down from the ad pool:

```
Total Amount: 100%
├── 10% → Walrus Provider (node operator, from WALRUS_PROVIDER_ADDRESS)
└── 90% → Further split:
    ├── 10% → Foundation (9% of total)
    └── 90% → Recipient (81% of total):
        ├── PM Pool (if PM active: status='open')
        └── Creator (if PM passed: status='resolved' AND resolution='safe')
```

**Incentive Structure:**
- **PM Active**: PM pool gets 81% → Sweetens the pot, incentivizes safety reviews
- **PM Passed**: Creator gets 81% → Rewards verified safe content
- **Walrus Provider**: Always gets 10% → Incentivizes decentralized node operation
- **Foundation**: Always gets 9% → Platform infrastructure

## Flow

### 1. Content Serving

**Walrus Node:**
- Serves content from Walrus storage
- Displays ads or checks subscriber status
- Collects signatures/proofs:
  - **Ad impressions**: ZK proofs of ad views
  - **Subscriber passes**: Signed statements of subscriber access

### 2. Signature Collection

**Walrus Node collects:**
- Verified proof hashes (Merkle/ZK verified)
- Content ID (dApp ID or content identifier)
- Proof metadata (timestamp, block header, etc.)

**Verification:**
- Proofs verified off-chain via Merkle tree inclusion
- ZK proofs verified via zk-service
- Signatures validated before drawdown

### 3. Drawdown Request

**Walrus Node calls:**
```http
POST /ads/walrus/drawdown
Content-Type: application/json

{
  "contentId": "dapp_123",
  "verifiedProofs": [
    "0xabc123...",  // Proof hash 1
    "0xdef456...",  // Proof hash 2
    ...
  ],
  "amount": 1000000000,  // Amount in MIST (1 SUI)
  "walrusProvider": "0x..." // Optional, defaults to WALRUS_PROVIDER_ADDRESS
}
```

### 4. Service Processing

**sui-service:**
1. Validates proofs exist and are verified (checks DGraph)
2. Gets content creator address (from dApp repository)
3. Checks PM status for content:
   - Queries PM service: `GET /markets/dapp/{contentId}`
   - Checks if any market has `status: 'open'` → PM active
   - Checks if any market has `status: 'resolved' AND resolution: 'safe'` → PM passed
4. Determines recipient:
   - If PM active → PM pool address
   - If PM passed → Creator address
   - Otherwise → Creator address (default)

### 5. On-Chain Execution

**Contract Function:**
```move
public fun walrus_drawdown(
    pool: &mut RevenuePool,
    verified_proofs: vector<vector<u8>>,
    content_id: vector<u8>,
    pm_active: bool,
    pm_pool: address,
    creator: address,
    foundation: address,
    walrus_provider: address,
    amount: u64,
    clock: &Clock,
    admin: &AdminCap,
    ctx: &mut TxContext
)
```

**On-Chain Actions:**
1. Verifies proofs are non-empty
2. Calculates splits:
   - 10% → Walrus provider
   - 9% → Foundation (10% of remainder)
   - 81% → PM pool (if active) OR creator (if PM passed)
3. Transfers SUI coins to recipients
4. Emits `WalrusDrawdown` event

### 6. Event Emission

**Event:**
```move
public struct WalrusDrawdown has copy, drop {
    pool_id: ID,
    walrus_provider: address,
    content_id: vector<u8>,
    amount: u64,
    walrus_share: u64,
    foundation_share: u64,
    pm_or_creator_share: u64,
    recipient: address,  // PM pool or creator
    pm_active: bool,
}
```

## Example Scenarios

### Scenario 1: PM Active (Content Under Review)

```
Content: dapp_123
PM Status: Active (status='open')
Amount: 1 SUI (1,000,000,000 MIST)

Distribution:
- Walrus Provider: 0.1 SUI (10%)
- Foundation: 0.09 SUI (9%)
- PM Pool: 0.81 SUI (81%) ← Sweetens the pot!
```

**Incentive:** PM gets revenue while active, encouraging safety reviews.

### Scenario 2: PM Passed (Content Verified Safe)

```
Content: dapp_123
PM Status: Resolved (status='resolved', resolution='safe')
Amount: 1 SUI (1,000,000,000 MIST)

Distribution:
- Walrus Provider: 0.1 SUI (10%)
- Foundation: 0.09 SUI (9%)
- Creator: 0.81 SUI (81%) ← Rewards verified safe content!
```

**Incentive:** Creator gets revenue after PM verification, rewarding truth.

### Scenario 3: No PM (Default to Creator)

```
Content: dapp_123
PM Status: None (no markets)
Amount: 1 SUI (1,000,000,000 MIST)

Distribution:
- Walrus Provider: 0.1 SUI (10%)
- Foundation: 0.09 SUI (9%)
- Creator: 0.81 SUI (81%) ← Default to creator
```

**Incentive:** Content without PM still gets creator share.

## Configuration

### Environment Variables

**sui-service:**
```bash
# Required
WALRUS_PROVIDER_ADDRESS=0x...  # Walrus node provider public key/address
PM_SERVICE_URL=http://localhost:3004  # PM service URL
FOUNDATION_ADDRESS=0x...  # Foundation address
PM_POOL_ADDRESS=0x...  # PM pool address
REVENUE_POOL_OBJECT_ID=0x...  # RevenuePool shared object ID
ADMIN_CAP_OBJECT_ID=0x...  # AdminCap object ID
ADMIN_PRIVATE_KEY=...  # Admin private key for signing

# Optional
DGRAPH_SERVICE_URL=http://localhost:3003  # For proof verification
```

**Walrus Node:**
```bash
# Node operator sets their provider address
WALRUS_PROVIDER_ADDRESS=0x...  # Their public key/address (gets 10% share)
```

## Security Considerations

1. **Proof Verification**: Proofs must be verified off-chain before drawdown
2. **Admin Cap**: Only admin can call `walrus_drawdown` (prevents unauthorized drawdowns)
3. **Double-Spend Prevention**: Proofs should be marked as "used" after drawdown
4. **PM Status Check**: PM status checked off-chain (contracts can't query DGraph)
5. **Amount Validation**: Contract validates amount > 0 and sufficient pool balance

## Integration Points

### PM Service Integration

**Check PM Status:**
```typescript
GET /markets/dapp/{contentId}

Response:
{
  "markets": [
    {
      "id": "market_123",
      "dappId": "dapp_123",
      "status": "open" | "resolved" | "cancelled",
      "resolution": "safe" | "unsafe" | null,
      ...
    }
  ]
}
```

**PM Active Logic:**
- `pmActive = markets.some(m => m.status === 'open')`

**PM Passed Logic:**
- `pmPassed = markets.some(m => m.status === 'resolved' && m.resolution === 'safe')`

### DGraph Integration

**Verify Proofs:**
```typescript
GET /impressions/proof/{proofHash}

Response:
{
  "verified": true,
  "proofHash": "...",
  ...
}
```

## Benefits

1. **Decentralization**: Incentivizes Walrus node operators (10% share)
2. **Truth-Seeking**: PM gets revenue while active (sweetens the pot)
3. **Creator Rewards**: Creators get revenue after PM verification (rewards truth)
4. **Foundation Support**: Foundation always gets share (platform sustainability)
5. **Privacy-Preserving**: Proofs don't reveal individual viewer identities

## Future Enhancements

1. **Subscriber Pass Drawdown**: Similar flow for subscriber revenue
2. **Batch Drawdowns**: Aggregate multiple content IDs in one transaction
3. **Governance-Controlled Splits**: Allow governance to adjust percentages
4. **Multi-Content PM**: Handle cases where content has multiple PMs
5. **PM Resolution Priority**: Handle edge cases (multiple PMs, conflicting resolutions)
