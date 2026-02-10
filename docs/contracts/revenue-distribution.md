# Revenue Distribution

## Overview

The DLUX ad network implements a fair revenue distribution model that rewards content creators, supports platform development, and funds community governance through prediction markets.

## Revenue Split

| Recipient | Percentage | Purpose |
|-----------|------------|---------|
| Content Creator | 50% | Reward for hosting/creating ad-eligible content |
| Foundation | 30% | Platform infrastructure, development, operations |
| PM Pool | 20% | Prediction market incentives and liquidity |

## Revenue Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ADVERTISER                                         │
│                                                                             │
│  Creates campaign → Funds escrow → Sets bid per impression                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Campaign Budget
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CAMPAIGN ESCROW                                       │
│                                                                             │
│  • Holds campaign funds securely                                            │
│  • Lock period prevents immediate withdrawal                                │
│  • Deducted per verified impression                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Impression Cost (bid amount)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REVENUE POOL                                         │
│                                                                             │
│  • Aggregates impression payments                                           │
│  • Batches for efficient distribution                                       │
│  • Tracks total collected                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ distribute_revenue()
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
            │    CREATOR    │ │  FOUNDATION   │ │    PM POOL    │
            │     (50%)     │ │     (30%)     │ │     (20%)     │
            │               │ │               │ │               │
            │ • dApp owner  │ │ • Platform    │ │ • Prediction  │
            │ • Content     │ │   costs       │ │   market      │
            │   creator     │ │ • Development │ │   liquidity   │
            │               │ │ • Operations  │ │ • Governance  │
            └───────────────┘ └───────────────┘ └───────────────┘
```

## Distribution Triggers

Revenue distribution can be triggered in several ways:

### 1. Threshold-Based (Automatic)

When the revenue pool reaches a certain threshold (e.g., 100 SUI), automatic distribution is triggered.

```move
// In metadata_pm.move
public fun distribute_ad_revenue(
    pool: &mut AdRevenuePool,
    merkle_root: &MerkleRoot,
    verified_proofs: vector<vector<u8>>,
    ctx: &mut TxContext
) {
    // Check threshold
    assert!(merkle_root.leaf_count >= merkle_root.threshold, E_THRESHOLD_NOT_MET);
    // ... distribution logic
}
```

### 2. Batch-Based (Merkle Verification)

When a batch of impressions is verified via Merkle tree:

1. Off-chain service aggregates impression proofs
2. Builds Merkle tree from proofs
3. Submits Merkle root to contract
4. Contract verifies and triggers distribution

### 3. Manual (Admin-Triggered)

Admin can trigger distribution at any time:

```move
// In ad_payments.move
public fun distribute_revenue(
    pool: &mut RevenuePool,
    creator: address,
    foundation: address,
    pm_pool: address,
    amount: u64,
    clock: &Clock,
    _admin: &AdminCap,
    ctx: &mut TxContext
)
```

## Calculation Examples

### Example 1: Single Impression

```
Campaign bid: 0.01 SUI (10,000,000 MIST)

Distribution:
├── Creator:    0.005 SUI   (5,000,000 MIST)
├── Foundation: 0.003 SUI   (3,000,000 MIST)
└── PM Pool:    0.002 SUI   (2,000,000 MIST)
```

### Example 2: Batch Distribution

```
Batch: 1000 impressions @ 0.01 SUI each
Total: 10 SUI (10,000,000,000 MIST)

Distribution:
├── Creator:    5 SUI    (50%)
├── Foundation: 3 SUI    (30%)
└── PM Pool:    2 SUI    (20%)
```

### Example 3: Monthly Campaign

```
Campaign budget: 1000 SUI
Impressions served: 90,000
Average CPI: ~0.011 SUI
Remaining budget refunded: 10 SUI

Revenue distributed (990 SUI):
├── Creator:    495 SUI
├── Foundation: 297 SUI
└── PM Pool:    198 SUI
```

## Contract Implementation

### Revenue Pool Distribution (ad_payments.move)

```move
public fun distribute_revenue(
    pool: &mut RevenuePool,
    creator: address,
    foundation: address,
    pm_pool: address,
    amount: u64,
    clock: &Clock,
    _admin: &AdminCap,
    ctx: &mut TxContext
) {
    assert!(balance::value(&pool.balance) >= amount, E_INSUFFICIENT_FUNDS);
    
    // Calculate shares
    let creator_share = amount * 50 / 100;
    let foundation_share = amount * 30 / 100;
    let pm_share = amount - creator_share - foundation_share;
    
    // Withdraw and distribute
    let creator_balance = balance::split(&mut pool.balance, creator_share);
    let foundation_balance = balance::split(&mut pool.balance, foundation_share);
    let pm_balance = balance::split(&mut pool.balance, pm_share);
    
    transfer::public_transfer(coin::from_balance(creator_balance, ctx), creator);
    transfer::public_transfer(coin::from_balance(foundation_balance, ctx), foundation);
    transfer::public_transfer(coin::from_balance(pm_balance, ctx), pm_pool);
    
    pool.last_distribution = clock.timestamp_ms();
    
    event::emit(RevenueDistributed {
        pool_id: pool.id.to_inner(),
        creator_share,
        pm_share,
        foundation_share,
    });
}
```

### Ad Revenue Pool Distribution (metadata_pm.move)

```move
public fun distribute_ad_revenue(
    pool: &mut AdRevenuePool,
    merkle_root: &MerkleRoot,
    verified_proofs: vector<vector<u8>>,
    _ctx: &mut TxContext
) {
    // Check threshold
    assert!(merkle_root.leaf_count >= merkle_root.threshold, E_THRESHOLD_NOT_MET);
    assert!(!pool.distributed, E_ALREADY_DISTRIBUTED);
    
    // Verify proofs (placeholder)
    // ...
    
    // Calculate shares
    let creator_share = pool.total_revenue * 50 / 100;
    let pm_share = pool.total_revenue * 20 / 100;
    let foundation_share = pool.total_revenue * 30 / 100;
    
    // Emit distribution event
    event::emit(RevenueDistributed {
        content_id: *&pool.content_id,
        creator_share,
        pm_share,
        foundation_share,
    });
    
    pool.distributed = true;
    
    // TODO: Actual token transfers
}
```

## Integration with Storage Funding

Ad revenue can contribute to Walrus storage costs:

```
Ad Revenue
    │
    ▼
Revenue Pool → 50% Creator Share
                    │
                    ▼
              Storage Funding Pool
                    │
                    │ (after 50% term progress)
                    ▼
              Walrus Term Renewal
```

### Storage Funding Rules

1. **Term Structure**: Walrus storage is 2-year terms
2. **Funding Timeline**: Ads only contribute after 50% term elapsed
3. **Precarious Status**: >75% through term with <100% funded
4. **Auto-Renewal**: If fully funded by term end

## Events

### RevenueDistributed (ad_payments.move)

```move
public struct RevenueDistributed has copy, drop {
    pool_id: ID,
    creator_share: u64,
    pm_share: u64,
    foundation_share: u64,
}
```

### RevenueDistributed (metadata_pm.move)

```move
public struct RevenueDistributed has copy, drop {
    content_id: vector<u8>,
    creator_share: u64,
    pm_share: u64,
    foundation_share: u64,
}
```

## Off-Chain Indexing

Services should index revenue events for:

1. **Creator Dashboard**: Show earnings
2. **Advertiser Dashboard**: Show spend breakdown
3. **Platform Analytics**: Track revenue trends
4. **Payout Processing**: Queue payouts

### DGraph Schema

```graphql
type RevenueDistribution {
  id: ID!
  poolId: String!
  creatorAddress: String!
  creatorShare: Int!
  foundationShare: Int!
  pmShare: Int!
  totalAmount: Int!
  timestamp: DateTime!
}

type CreatorEarnings {
  address: String!
  totalAdRevenue: Int!
  pendingPayout: Int!
  lastPayout: DateTime
}
```

## Subscription Revenue (Platform-Wide)

Subscription payments go to the **foundation** account. Revenue flows into the **same ad-share account** that ad revenue uses:

1. **Programmatic amounts funded first** — Gas fees, Walrus fees, contract fees, and server/operational costs (e.g. keeping services running) are paid from revenue before any split.
2. **Remainder split**:
   - **90%** → **Ad-share account** (single pool; when creators draw down their ad-share credits, they receive both ad and subscriber share from this pool).
   - **10%** → Foundation (developer fund, API hosting).

The foundation acts as a slush fund to pay developers and keep APIs online. Subscription share is tracked per person/time and added to the ad-share pool; creators draw down from that combined pool.

### Signed statements (Brave-like)

Providers/creators receive **programmatically signed statements** so draw-down directly affects creators:

- **Ad statement** — Signed attestation of a creator’s share from verified ad impressions/clicks.
- **Subscriber statement** — Signed attestation of subscription share (per person/time) that feeds the ad-share pool.

These statements (Brave protocol–style) let creators prove and claim their combined share from the ad-share account.

| Source | After programmatic costs | Ad-share account (creators draw down) | Foundation |
|--------|--------------------------|---------------------------------------|------------|
| Ads | 100% | 50% creator, 20% PM, 30% foundation | (included) |
| Subscriptions | 100% | 90% | 10% |

See `docs/subscription-foundation-model.md` for the full model.

## Future Enhancements

1. **Dynamic Splits**: Allow creator to configure their revenue split (e.g., share with collaborators)

2. **Tiered Distribution**: Higher creator share for high-quality content

3. **Staking Bonuses**: Additional share for staked SUI

4. **Multi-Currency**: Support stablecoins and other tokens

5. **DAO Governance**: Community votes on split percentages
