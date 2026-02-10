# Decentralized Walrus Nodes Roadmap

## Vision

Enable anyone to run a Walrus node, serve content, collect verified signatures (ZK proofs), and earn revenue share from ad impressions and subscriber passes. This creates a truly decentralized content delivery network where node operators are incentivized to serve content truthfully.

## Current State

### ✅ Implemented
- **Off-chain batch processing**: Scheduler service processes drawdowns efficiently
- **Proof verification**: Merkle/ZK proof verification before drawdown
- **Revenue split**: 10% Walrus provider, 9% Foundation, 81% PM/creator
- **Double-spend prevention**: Proof tracking in DGraph
- **Queue system**: Walrus nodes can queue proofs for batch processing

### 🚧 In Progress
- **Public node registration**: Node registry in DGraph
- **ZK proof generation**: Service for generating proofs of content serving
- **Node reputation**: Tracking node performance and reliability

### 📋 Planned
- **Node discovery**: Public registry of available Walrus nodes
- **Load balancing**: Client-side node selection
- **Node incentives**: Staking and slashing mechanisms
- **Governance**: Node operator voting on network parameters

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Walrus Node Network                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Node A      │  │  Node B      │  │  Node C      │      │
│  │  (Public)    │  │  (Private)   │  │  (Public)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│         └─────────────────┼──────────────────┘             │
│                            │                                │
│         ┌──────────────────▼──────────────────┐            │
│         │   Content Serving & Proof Generation │            │
│         │   - Serve content from Walrus storage│            │
│         │   - Generate ZK proofs of views       │            │
│         │   - Sign content with node signature  │            │
│         └──────────────────┬──────────────────┘            │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Proof Collection                         │
│  - Ad impressions: ZK proofs of ad views                   │
│  - Subscriber passes: Signed statements                      │
│  - Content signatures: Node attestation                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Queue for Batch Processing                     │
│  POST /ads/walrus/queue-drawdown                           │
│  - Validates proofs                                         │
│  - Queues for scheduler                                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Scheduled Batch Processing                     │
│  - Processes pending drawdowns hourly                      │
│  - Batches by recipient (walrus, foundation, creator/PM)   │
│  - Executes efficient SUI transfers                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Revenue Distribution                           │
│  - 10% → Walrus Node Provider                              │
│  - 9% → Foundation                                         │
│  - 81% → PM Pool (if active) OR Creator (if PM passed)     │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Node Registration & Discovery (Q1 2025)

### 1.1 Node Registry JSON Schema

Node operators upload a JSON file to Walrus with their node details:

```json
{
  "schema": "walrus-node-registry/v1",
  "operatorAddress": "0x...",  // SUI address of node operator
  "nodeAddress": "0x...",       // Public node identifier (wallet address)
  "endpoint": "https://walrus-node.example.com",
  "region": "us-west",
  "public": true,
  "capacity": 1000,
  "version": "1.0.0",
  "features": ["zk-proofs", "ad-serving", "subscriber-passes"],
  "metadata": {
    "storageCapacity": 1000000000,
    "bandwidth": 1000000,
    "latency": 50,
    "description": "Public Walrus node serving content"
  },
  "signature": "0x..."  // Signature of operatorAddress signing the JSON
}
```

### 1.2 Registration Flow

1. **Node operator creates JSON file** with node details
2. **Signs JSON** with operator's private key
3. **Uploads to Walrus** via `POST /blobs/upload` with `contentType: application/json`
4. **PM service verifies** signature and validates schema
5. **DGraph indexes** minimal metadata (blobId, operatorAddress, verified status)

### 1.3 DGraph Index Schema (Minimal)

Only indexes what's needed for discovery, full data stays in Walrus:

```dql
type WalrusNode {
  blobId: string @index(hash) @upsert  # Walrus blob ID
  operatorAddress: string @index(hash)  # SUI address of operator
  nodeAddress: string @index(hash)     # Node identifier
  endpoint: string @index(hash)         # API endpoint
  region: string @index(hash)           # Geographic region
  public: bool @index(bool)             # Public node flag
  verified: bool @index(bool)           # PM verification status
  verifiedAt: datetime @index(hour)     # When PM verified
  status: string @index(hash)           # active, inactive, maintenance
  reputation: float @index(float)       # Reputation score
  registeredAt: datetime @index(hour)   # Registration timestamp
  lastSeen: datetime @index(hour)       # Last heartbeat
}
```

### 1.4 Registration Endpoint

```typescript
POST /walrus/nodes/register
Content-Type: multipart/form-data

file: <node-registry.json>
operatorAddress: 0x...

// Response:
{
  "blobId": "0xabc123...",
  "verified": true,
  "indexed": true,
  "nodeId": "node_0x..."
}
```

### 1.5 PM Verification Service

PM service verifies:
- JSON schema validity
- Signature authenticity (operatorAddress signed the JSON)
- Endpoint accessibility (optional health check)
- Updates DGraph with verified status

### 1.6 Node Discovery Endpoint

```typescript
GET /walrus/nodes?region=us-west&public=true&status=active&verified=true
// Returns minimal DGraph data + Walrus blobId for full details
{
  "nodes": [
    {
      "blobId": "0xabc123...",
      "operatorAddress": "0x...",
      "endpoint": "https://...",
      "region": "us-west",
      "reputation": 0.95,
      "status": "active"
    }
  ]
}

// Client fetches full details from Walrus using blobId if needed
GET /blobs/{blobId}
```

## Phase 2: ZK Proof Generation (Q1-Q2 2025)

### 2.1 Content Serving with ZK Proofs

When a Walrus node serves content, it generates a ZK proof that:
- Content was served (without revealing viewer identity)
- Ad was displayed (if applicable)
- Subscriber pass was validated (if applicable)
- Node signature attests to the serving

### 2.2 Proof Generation Service

```typescript
// services/zk-service/src/services/contentProofGenerator.ts

export class ContentProofGenerator {
  /**
   * Generate ZK proof for content serving
   */
  async generateContentProof(params: {
    contentId: string;
    nodeAddress: string;
    timestamp: number;
    adId?: string;
    subscriberPass?: string;
  }): Promise<{
    proof: string;
    publicSignals: string[];
    proofHash: string;
  }> {
    // Generate ZK proof using circom circuit
    // Proof attests:
    // - Content was served
    // - Node signature is valid
    // - Ad/subscriber data is valid (if present)
    // - No viewer identity revealed
  }
}
```

### 2.3 Node Signature

Each node signs content with its private key:
```typescript
const nodeSignature = sign({
  contentId,
  timestamp,
  nodeAddress
}, nodePrivateKey);
```

This signature proves the node served the content and can be verified on-chain.

## Phase 3: Public Node Incentives (Q2 2025)

### 3.1 Staking Mechanism

Public nodes can stake SUI to:
- Increase reputation
- Get priority in node selection
- Earn additional rewards

```move
public struct NodeStake has key {
  id: UID,
  nodeAddress: address,
  amount: u64,
  stakedAt: u64,
  reputationBoost: u64,
}
```

### 3.2 Reputation System

Node reputation based on:
- **Uptime**: Percentage of time node is available
- **Performance**: Average latency, error rate
- **Revenue**: Total revenue generated (proves value)
- **Stake**: Amount staked (shows commitment)

```typescript
reputationScore = (
  uptime * 0.3 +
  performanceScore * 0.3 +
  revenueScore * 0.2 +
  stakeScore * 0.2
)
```

### 3.3 Slashing Conditions

Nodes can be slashed (lose stake) for:
- **Malicious behavior**: Serving incorrect content
- **Double-spending**: Using proofs multiple times
- **Downtime**: Extended periods of unavailability
- **Fraud**: Fake proof generation

## Phase 4: Client Integration (Q2-Q3 2025)

### 4.1 Node Selection

Clients select nodes based on:
- **Reputation**: Higher reputation = better service
- **Latency**: Lower latency = faster content
- **Load**: Lower load = better performance
- **Region**: Closer region = lower latency

```typescript
async function selectBestNode(contentId: string, region?: string): Promise<WalrusNode> {
  const nodes = await getAvailableNodes({ region, status: 'active' });
  
  // Score nodes
  const scored = nodes.map(node => ({
    node,
    score: calculateScore(node) // reputation + latency + load
  }));
  
  // Select best node
  return scored.sort((a, b) => b.score - a.score)[0].node;
}
```

### 4.2 Load Balancing

Clients can:
- **Round-robin**: Distribute requests across nodes
- **Weighted**: Use reputation-weighted selection
- **Failover**: Switch to backup node if primary fails

### 4.3 Proof Collection

Clients collect proofs from nodes:
```typescript
const proof = await walrusNode.serveContent({
  contentId: 'dapp_123',
  adId: 'ad_456',
  subscriberPass: 'pass_789'
});

// Proof includes:
// - ZK proof of serving
// - Node signature
// - Merkle tree inclusion proof
```

## Phase 5: Governance & Network Parameters (Q3 2025)

### 5.1 Node Operator Voting

Node operators can vote on:
- **Revenue splits**: Adjust percentages
- **Staking requirements**: Minimum stake amounts
- **Slashing parameters**: Conditions and amounts
- **Network upgrades**: Protocol changes

### 5.2 Parameter Updates

```move
public fun updateRevenueSplit(
  admin: &AdminCap,
  walrusShare: u64,
  foundationShare: u64,
  recipientShare: u64
) {
  // Update split percentages (requires governance vote)
}
```

## Implementation Checklist

### Immediate (This Sprint)
- [x] Off-chain batch processing scheduler
- [x] Queue system for drawdowns
- [x] Proof verification (Merkle/ZK)
- [x] Double-spend prevention

### Short-term (Next 2 Weeks)
- [ ] Node registry schema in DGraph
- [ ] Node registration endpoint
- [ ] Node discovery endpoint
- [ ] Basic reputation tracking

### Medium-term (Next Month)
- [ ] ZK proof generation for content serving
- [ ] Node signature verification
- [ ] Client-side node selection
- [ ] Load balancing logic

### Long-term (Next Quarter)
- [ ] Staking mechanism
- [ ] Slashing conditions
- [ ] Governance voting
- [ ] Network parameter updates

## Revenue Model

### For Node Operators
- **10% of ad revenue** from content they serve
- **Additional rewards** for high reputation
- **Staking rewards** for staked SUI

### For Content Creators
- **81% of ad revenue** (if PM passed) or goes to PM pool (if active)
- **Incentivized** to create quality content that passes PM

### For Foundation
- **9% of ad revenue** for platform sustainability
- **Governance** over network parameters

## Security Considerations

1. **Proof Verification**: All proofs verified before drawdown
2. **Node Reputation**: Prevents malicious nodes
3. **Staking**: Economic security through staking
4. **Slashing**: Deterrent for malicious behavior
5. **Double-Spend Prevention**: Proof tracking in DGraph

## Success Metrics

- **Number of public nodes**: Target 100+ nodes in first year
- **Network uptime**: Target 99.9% availability
- **Average latency**: Target <100ms for content serving
- **Revenue distributed**: Track total revenue to nodes
- **Node reputation**: Average reputation score >0.8

## Next Steps

1. **Implement node registry** (Phase 1.1-1.3)
2. **Build ZK proof generation** (Phase 2)
3. **Create client SDK** for node selection (Phase 4.1)
4. **Launch public testnet** with incentivized nodes
5. **Gather feedback** and iterate on design

## Resources

- [Walrus Drawdown Flow](./WALRUS_DRAWDOWN_FLOW.md)
- [Off-Chain Optimization](./WALRUS_DRAWDOWN_OFFCHAIN_OPTIMIZATION.md)
- [ZK Proof Generation](../circuits/README.md)
- [DGraph Schema](../services/dgraph-service/src/dgraph/schema.dql)
