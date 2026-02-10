# Ad Network User Journeys

## Overview

This document describes the complete user journeys through the DLUX ad network system, covering ad creation, content creation, user interactions, click bundling, revenue redemption, and fund distribution through prediction markets.

## Table of Contents

1. [Ad Journey - Creating an Ad Campaign](#ad-journey)
2. [Content Creation Journey - Building a dApp/Content](#content-creation-journey)
3. [User Journey - Viewing Content and Signing Ads](#user-journey)
4. [Subscribe Journey - Subscribing to Content](#subscribe-journey)
5. [Click Bundling & Redemption Journey](#click-bundling-redemption)
6. [Revenue Distribution Journey - PM Resolution & Payouts](#revenue-distribution-journey)

---

## Ad Journey - Creating an Ad Campaign

### Overview

The ad journey covers how advertisers create campaigns to promote their content (posts or dApps) on the DLUX platform.

### Step-by-Step Flow

#### 1. Select Content to Promote

- User navigates to their post or dApp
- Clicks "Promote" button
- System loads content details (content ID, title, description, target URL)

**Technical Details:**
- Content can be any post or dApp on the platform
- Content metadata is retrieved from DGraph service
- User must be the owner of the content to promote it

#### 2. Configure Campaign Parameters

**Budget & Bidding:**
- Set total campaign budget (in SUI)
- Set maximum bid per impression (CPI - Cost Per Impression)
- Optional: Set daily budget limit

**Placements:**
- Select where ads should appear:
  - `gate`: Pre-dApp display (shown before users access dApps)
  - `slip`: Algorithmic feed integration
  - `install`: Installation prompts

**Targeting (Optional):**
- **User Zones**: GeoIP targeting (e.g., `["US", "EU", "ASIA"]`)
- **Content Zones**: Content location zones for targeting
- **Planet**: Digital twin support (0=Earth, 1=Moon, 2=Mars)
- **Categories/Tags**: Content category targeting
- **Exclusions**: Categories to exclude

**Verification Method:**
- Choose verification method:
  - ZK proof (default, privacy-preserving)
  - Cookie-based (for dApps)
  - Checksum-based (for posts/dApps)

#### 3. Review and Submit

- Preview campaign settings
- See estimated reach and impressions
- Confirm budget allocation
- Submit campaign

#### 4. Campaign Creation (On-Chain)

**Transaction Flow:**
```typescript
// 1. Create payment transaction
const paymentCoin = await suiClient.getCoins({
  owner: advertiserAddress,
  coinType: '0x2::sui::SUI'
});

// 2. Call create_campaign_entry
const tx = new TransactionBlock();
tx.moveCall({
  target: `${PACKAGE_ID}::ad_campaigns::create_campaign_entry`,
  arguments: [
    tx.object(paymentCoinId),           // SUI payment (escrowed)
    tx.pure(Buffer.from(campaignTitle)),
    tx.pure(Buffer.from(description)),
    tx.pure(Buffer.from(targetUrl)),
    tx.pure(placements.map(p => Buffer.from(p))),
    tx.pure(bidAmount),                 // bid in MIST
    tx.pure(startTimestamp),
    tx.pure(endTimestamp),
    tx.pure(userZones.map(z => Buffer.from(z))),
    tx.pure(contentZones.map(z => Buffer.from(z))),
    tx.pure(planet || null),
    tx.pure(lockDurationMs),            // escrow lock duration
    tx.object(CLOCK_ID),
  ],
});
```

**On-Chain Actions:**
1. **Campaign Creation**: Creates `AdCampaign` shared object
2. **Escrow Creation**: Creates `CampaignEscrow` and escrows payment
3. **Event Emission**: Emits `CampaignCreated` event

**Off-Chain Actions:**
1. DGraph service indexes campaign
2. PM service creates prediction market for ad quality
3. Campaign status set to "active"

#### 5. Campaign Activation

- Campaign status: "active"
- Ads start appearing in selected placements
- Impression tracking begins
- ZK proof generation starts for ad views

#### 6. Monitor Performance

- View campaign dashboard
- Track impressions, clicks, conversions
- Monitor budget spend
- View prediction market status

---

## Content Creation Journey - Building a dApp/Content

### Overview

This journey covers how content creators build dApps or create content, and optionally mark it as an ad or promotional content.

### Step-by-Step Flow

#### 1. Create Content/dApp

**For dApps:**
- Upload dApp files to Walrus service
- Create dApp metadata (title, description, category)
- Set dApp configuration
- Deploy to IPFS/Walrus

**For Posts:**
- Create post content (text, images, media)
- Add metadata (title, description, tags)
- Set visibility and permissions

**Technical Details:**
- Content stored in DGraph with unique `contentId`
- dApps stored in Walrus with blob references
- Posts stored in DGraph with content references

#### 2. Optionally Mark as Ad

**Option A: Mark Existing Content as Ad**
- Navigate to content
- Click "Promote" or "Create Ad Campaign"
- Follow [Ad Journey](#ad-journey) steps

**Option B: Create Content with Ad Intent**
- During content creation, select "Promote this content"
- Content creation and ad campaign creation happen together
- Content is automatically linked to campaign

**Technical Implementation:**
```typescript
// Content creation with ad campaign
const content = await dgraphService.createContent({
  title: "My dApp",
  description: "Amazing dApp",
  owner: creatorAddress,
  // ... other fields
});

// Optionally create ad campaign
if (promoteAsAd) {
  const campaign = await createCampaign({
    contentIds: [content.id],
    // ... campaign parameters
  });
}
```

#### 3. Content Goes Live

- Content is published and visible
- If ad campaign is active, content appears in ad placements
- Users can discover content through:
  - Regular feeds
  - Ad placements (if promoted)
  - Search and discovery

#### 4. Content Receives Ad Impressions

- When users view content through ad placements:
  - Ad overlay/modal shown (for gate placement)
  - Ad appears in feed (for slip placement)
  - ZK proofs generated for privacy-preserving verification
  - Impressions tracked in DGraph

---

## User Journey - Viewing Content and Signing Ads

### Overview

This journey covers how users interact with ads, view content, and sign ads (generating ZK proofs).

### Step-by-Step Flow

#### 1. Discover Content

**Via Ad Placement:**
- User clicks on dApp or post
- Sandbox service checks for active ads
- If ads exist, auction runs to select highest bid ad
- Ad overlay/modal displayed before content

**Via Feed:**
- User scrolls through algorithmic feed
- Ads inserted at calculated positions (e.g., every 5-10 posts)
- Ads clearly marked as "Promoted" or "Sponsored"

#### 2. View Ad

**Pre-dApp Display (Gate Placement):**
```
User clicks dApp
    ↓
Sandbox service checks for active ads
    ↓
If ads exist:
    - Run auction (select highest bid)
    - Display ad overlay/modal
    - Show ad content (title, description, image)
    - Show "Continue to Content" button
```

**Feed Display (Slip Placement):**
```
User scrolls feed
    ↓
Ad insertion algorithm calculates position
    ↓
Ad appears in feed with "Promoted" label
    ↓
User views ad in feed context
```

#### 3. Sign Ad (Generate ZK Proof)

**When User Clicks "Continue to Content" or Views Ad:**

1. **Client Generates ZK Proof:**
   ```typescript
   const proof = await zkService.generateProof({
     adId: campaign.id,
     viewerIdentity: userIdentity,  // Private witness (not revealed)
     contentId: content.id,
     blockHeader: currentBlockHeader,
     secretSalt: randomSalt,
     actionType: 'impression'
   });
   ```

2. **Proof Components:**
   - **Public Signals**: `adId`, `contentId`, `blockHeader` (visible)
   - **Private Witness**: `viewerIdentity` (hidden, never revealed)
   - **Proof**: Cryptographic proof that user viewed ad without revealing identity

3. **Submit Proof to DGraph:**
   ```typescript
   await dgraphService.recordImpression({
     adId: campaign.id,
     contentId: content.id,
     zkProof: proof.proof,
     proofHash: proof.proofHash,
     encryptedViewer: proof.encryptedViewer,
     blockHeader: proof.blockHeader
   });
   ```

**Privacy Guarantees:**
- Viewer identity never revealed
- Proof is cryptographically verifiable
- Individual views cannot be linked to users
- Aggregate statistics available without privacy loss

#### 4. Interact with Ad

**Option A: Click Ad**
- User clicks ad (e.g., "Learn More" button)
- Click redirects through Walrus gateway: `/ads/click?adId=...&contentId=...&target=...`
- Gateway enforces consent
- ZK click proof generated
- User redirected to target URL with `dlux_click` token

**Click Flow:**
```
User clicks ad
    ↓
Redirect to walrus.dlux.io/ads/click
    ↓
Gateway enforces consent
    ↓
Generate ZK click proof
    ↓
Record click in DGraph
    ↓
Redirect to target URL with dlux_click token
```

**Option B: Dismiss/Skip Ad**
- User clicks "Skip" or dismisses ad
- Proceeds to content
- Impression still recorded (ad was shown)

#### 5. Access Content

- After ad interaction, user accesses content
- For dApps: Sandbox serves dApp content
- For posts: Post content displayed
- User can now interact with content normally

#### 6. Conversion Tracking (Optional)

**If User Completes Action on Advertiser Site:**
- Advertiser redirects to: `/ads/convert?adId=...&contentId=...&click=...`
- Gateway verifies click token
- ZK conversion proof generated
- Conversion recorded in DGraph

---

## Subscribe Journey - Subscribing to Content

### Overview

This journey covers how users subscribe to content creators or premium content, which may include ad-free experiences.

### Step-by-Step Flow

#### 1. Discover Subscription Option

**For Content Creators:**
- User views creator profile
- Sees "Subscribe" button
- Views subscription tiers and benefits

**For Premium Content:**
- User views premium content
- Sees paywall or subscription requirement
- Views pricing and access details

#### 2. Select Subscription

- Choose subscription tier (if multiple options)
- Review benefits:
  - Ad-free experience
  - Premium content access
  - Early access to features
  - Creator perks

#### 3. Payment & Subscription

**SUI Payment:**
```typescript
// Create payment transaction
const paymentTx = await suiClient.transferObject({
  objectId: suiCoinId,
  recipient: creatorAddress,
  amount: subscriptionPrice
});

// Record subscription
await subscriptionService.createSubscription({
  subscriber: userAddress,
  creator: creatorAddress,
  tier: selectedTier,
  paymentTxId: paymentTx.digest,
  expiresAt: calculateExpiry()
});
```

#### 4. Subscription Active

- Subscription status: "active"
- User gains access to:
  - Ad-free browsing (ads skipped)
  - Premium content
  - Creator benefits
- Subscription tracked in DGraph

#### 5. Ad-Free Experience

**When Subscription Active:**
- Sandbox service checks subscription status
- If active, ads are skipped
- User proceeds directly to content
- No ad impressions recorded

**Technical Implementation (per-creator):**
```typescript
// Subscription is per-creator (per profile). Subscribe to Creator A → ad-free when viewing Creator A's dApps.
// Sandbox auto-derives creator (dApp owner) from dapps/lookup and checks subscription to that creator.
const subscriptionStatus = await checkSubscription(userAddress, creatorAddress);
if (subscriptionStatus.active) {
  return { shown: false, blocked: 'subscription' };
}
```

---

## Click Bundling & Redemption Journey

### Overview

This journey covers how confirmed clicks are bundled in content, aggregated to reach thresholds, and then redeemed as tranches against the ad campaign escrow.

### Step-by-Step Flow

#### 1. Click Recording

**Individual Click:**
- User clicks ad (see [User Journey - Click Ad](#user-journey))
- ZK click proof generated
- Click recorded in DGraph with:
  - `adId`: Campaign ID
  - `contentId`: Content where ad appeared
  - `clickTokenHash`: Anonymous click token
  - `targetHash`: Target URL hash
  - `zkProof`: ZK proof data
  - `encryptedViewer`: Encrypted viewer identity
  - `blockHeader`: Block header for verification

**DGraph Storage:**
```typescript
await adEventRepository.saveClick({
  adId,
  contentId,
  clickTokenHash,
  targetHash,
  zkProof: JSON.stringify(zkProof),
  proofHash,
  encryptedViewer,
  blockHeader,
  verified: true
});
```

#### 2. Click Aggregation

**Threshold Check:**
- DGraph monitors click count per `contentId`
- When threshold reached (e.g., 100 clicks):
  ```typescript
  const count = await adEventRepository.countClicks(contentId);
  if (count >= AD_CLICK_THRESHOLD) {
    // Trigger aggregation
  }
  ```

**Aggregation Process:**
1. Fetch all clicks for content
2. Extract encrypted viewer data
3. Aggregate using homomorphic encryption:
   ```typescript
   const aggregateRes = await axios.post(`${ZK_SERVICE_URL}/proofs/aggregate`, {
     encryptedImpressions: clicks.map(click => click.encryptedViewer)
   });
   ```
4. Store aggregate:
   ```typescript
   await adEventRepository.saveClickAggregate({
     adId,
     contentId,
     encryptedCount: aggregateRes.data.encryptedAggregate,
     threshold: AD_CLICK_THRESHOLD,
     currentCount: clicks.length,
     reachedAt: new Date()
   });
   ```

#### 3. Merkle Tree Construction

**Batch Verification:**
- When threshold reached, build Merkle tree:
  - Each click proof is a leaf
  - Merkle root computed
  - Merkle root stored for on-chain verification

**Merkle Root Creation:**
```typescript
const merkleRoot = await buildMerkleTree({
  proofs: clickProofs,
  contentId: content.id,
  threshold: AD_CLICK_THRESHOLD
});

// Store in DGraph
await dgraphService.saveMerkleRoot({
  contentId: content.id,
  rootHash: merkleRoot.rootHash,
  leafCount: merkleRoot.leafCount,
  threshold: merkleRoot.threshold
});
```

#### 4. Tranche Redemption (On-Chain)

**Redeem Clicks Against Campaign Escrow:**

When a tranche of clicks is ready for redemption:

1. **Calculate Redemption Amount:**
   ```typescript
   const clickCount = aggregate.currentCount;
   const bidPerImpression = campaign.bid;
   const totalAmount = clickCount * bidPerImpression;
   ```

2. **On-Chain Redemption Transaction:**
   ```typescript
   const tx = new TransactionBlock();
   tx.moveCall({
     target: `${PACKAGE_ID}::ad_campaigns::record_impression_with_escrow`,
     arguments: [
       tx.object(campaignId),
       tx.object(escrowId),
       tx.object(revenuePoolId),
       tx.object(adminCapId),
       tx.object(CLOCK_ID)
     ]
   });
   ```

3. **On-Chain Actions:**
   - Verify Merkle root (if threshold-based)
   - Deduct from campaign `remaining_budget`
   - Withdraw from `CampaignEscrow` to `RevenuePool`
   - Increment campaign `impression_count`
   - Emit `ImpressionRecorded` event

**Contract Flow:**
```move
// In ad_campaigns.move
public entry fun record_impression_with_escrow(
    campaign: &mut AdCampaign,
    escrow: &mut CampaignEscrow,
    pool: &mut RevenuePool,
    admin: &AdminCap,
    clock: &Clock,
): bool {
    // Deduct from campaign budget
    if (!deduct_impression_cost(campaign, clock)) {
        return false
    };
    
    // Withdraw from escrow to revenue pool
    let bid = campaign.bid;
    ad_payments::withdraw_for_impression(escrow, bid, pool, admin);
    
    true
}
```

#### 5. Revenue Pool Accumulation

**Pool Structure:**
- `RevenuePool` is a shared object
- Accumulates funds from multiple campaigns
- Tracks `total_collected` and `balance`
- Ready for batch distribution

**Pool Updates:**
```move
// In ad_payments.move
public fun withdraw_for_impression(
    escrow: &mut CampaignEscrow,
    amount: u64,
    pool: &mut RevenuePool,
    _admin: &AdminCap,
): bool {
    // Withdraw from escrow
    let withdrawn = balance::split(&mut escrow.balance, amount);
    escrow.total_withdrawn = escrow.total_withdrawn + amount;
    
    // Add to revenue pool
    pool.total_collected = pool.total_collected + amount;
    balance::join(&mut pool.balance, withdrawn);
    
    true
}
```

---

## Revenue Distribution Journey - PM Resolution & Payouts

### Overview

This journey covers how ad revenue is distributed after prediction market resolution, with funds going to PM winners, content creators, and the foundation.

### Step-by-Step Flow

#### 1. Prediction Market Creation

**When Ad Campaign Created:**
- PM service automatically creates prediction market
- Market parameters:
  - **Safety Metric**: `ad-quality`
  - **Market Pool**: 5-10% of campaign budget
  - **Duration**: 7 days
  - **Resolution**: Capital-weighted (most capital wins)

**Market Creation:**
```typescript
await pmService.createMarket({
  contentId: campaign.contentIds[0],
  metric: 'ad-quality',
  marketPool: campaign.totalBudget * 0.05, // 5%
  duration: 7 * 24 * 60 * 60 * 1000, // 7 days
  resolutionMethod: 'capital-weighted'
});
```

#### 2. Market Trading Phase

**Users Bet on Ad Quality:**
- Users can bet "high-quality" or "low-quality"
- Bets tracked in PM service
- Market odds reflect community sentiment
- Ad performance data displayed as informational signals (does not resolve market)

**Betting Flow:**
```typescript
await pmService.placeBet({
  marketId: market.id,
  user: userAddress,
  side: 'high-quality', // or 'low-quality'
  amount: betAmount
});
```

#### 3. Market Resolution

**After 7 Days:**
- Market resolves based on capital-weighted outcome
- Side with most capital wins
- Winners determined

**Resolution Process:**
```typescript
const resolution = await pmService.resolveMarket({
  marketId: market.id,
  resolution: 'capital-weighted' // Most capital wins
});

// Calculate winners
const winningSide = resolution.stakeYes > resolution.stakeNo 
  ? 'yes' 
  : 'no';
const winningPool = winningSide === 'yes' 
  ? resolution.stakeYes 
  : resolution.stakeNo;
const losingPool = winningSide === 'yes' 
  ? resolution.stakeNo 
  : resolution.stakeYes;
```

#### 4. Revenue Distribution Trigger

**When PM Resolves:**
- Revenue distribution can be triggered
- Distribution includes:
  - Ad revenue from clicks/impressions
  - PM pool funds (if market resolved favorably)

**Distribution Trigger:**
```typescript
// Check if revenue pool has funds
const poolBalance = await getPoolBalance(revenuePoolId);

// Check if PM market resolved
const market = await pmService.getMarket(marketId);
if (market.resolved && poolBalance > 0) {
  // Trigger distribution
  await distributeRevenue({
    poolId: revenuePoolId,
    contentId: content.id,
    creatorAddress: content.owner,
    pmMarketId: market.id
  });
}
```

#### 5. On-Chain Revenue Distribution

**Distribution Transaction:**
```typescript
const tx = new TransactionBlock();
tx.moveCall({
  target: `${PACKAGE_ID}::ad_payments::distribute_revenue`,
  arguments: [
    tx.object(revenuePoolId),
    tx.pure(creatorAddress),
    tx.pure(foundationAddress),
    tx.pure(pmPoolAddress),
    tx.pure(distributionAmount),
    tx.object(CLOCK_ID),
    tx.object(adminCapId)
  ]
});
```

**Distribution Logic:**
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
) {
    // Calculate shares
    let creator_share = amount * 50 / 100;      // 50%
    let foundation_share = amount * 30 / 100;  // 30%
    let pm_share = amount * 20 / 100;           // 20%
    
    // Withdraw and distribute
    let creator_balance = balance::split(&mut pool.balance, creator_share);
    let foundation_balance = balance::split(&mut pool.balance, foundation_share);
    let pm_balance = balance::split(&mut pool.balance, pm_share);
    
    // Transfer to recipients
    transfer::public_transfer(coin::from_balance(creator_balance, ctx), creator);
    transfer::public_transfer(coin::from_balance(foundation_balance, ctx), foundation);
    transfer::public_transfer(coin::from_balance(pm_balance, ctx), pm_pool);
    
    // Emit event
    event::emit(RevenueDistributed {
        pool_id: pool.id.to_inner(),
        creator_share,
        pm_share,
        foundation_share,
    });
}
```

#### 6. PM Winner Payouts

**After Revenue Distribution:**
- PM pool receives 20% of ad revenue
- PM winners receive payouts from PM pool

**Winner Payout Calculation:**
```typescript
// For each winning bet
const bets = await pmService.getBetsForMarket(marketId);
for (const bet of bets) {
  if (bet.side === winningSide) {
    // Winner gets stake back + proportional share of losing pool
    bet.payout = bet.amount + (bet.amount / winningPool) * losingPool;
  } else {
    // Losers get nothing
    bet.payout = 0;
  }
  await pmService.updateBet(bet);
}
```

**Payout Distribution:**
- Winners receive their stake + proportional share of losing pool
- Losers receive nothing (stake goes to winners)
- PM pool funds distributed to winners

#### 7. Creator & Foundation Shares

**Creator Share (50%):**
- Content creator receives 50% of ad revenue
- Funds sent directly to creator's wallet
- Can be used for:
  - Storage funding
  - Platform fees
  - Withdrawal to external wallet

**Foundation Share (30%):**
- Foundation receives 30% of ad revenue
- Funds support:
  - Platform infrastructure
  - Development costs
  - Operations

**Revenue Split Summary:**
```
Total Ad Revenue: 100 SUI
├── Creator: 50 SUI (50%)
├── Foundation: 30 SUI (30%)
└── PM Pool: 20 SUI (20%)
    └── Distributed to PM winners
```

#### 8. Post-Resolution Actions

**If PM Resolved "High Quality":**
- Campaign continues
- Better ad placement
- Advertiser reputation improved

**If PM Resolved "Low Quality":**
- Campaign may be paused
- Advertiser notified
- Future campaign eligibility affected

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AD CAMPAIGN CREATION                             │
│                                                                          │
│  Advertiser → Create Campaign → Fund Escrow → Campaign Active          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONTENT CREATION & MARKING                          │
│                                                                          │
│  Creator → Build dApp/Content → Optionally Mark as Ad → Content Live   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    USER VIEWS CONTENT & SIGNS AD                          │
│                                                                          │
│  User → Views Ad → Generates ZK Proof → Clicks Ad → Accesses Content   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLICK BUNDLING & AGGREGATION                          │
│                                                                          │
│  Clicks → Threshold Reached → Merkle Tree → Aggregate Proofs           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRANCHE REDEMPTION (ON-CHAIN)                         │
│                                                                          │
│  Aggregate → Redeem Tranche → Withdraw from Escrow → Add to Pool        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PREDICTION MARKET RESOLUTION                          │
│                                                                          │
│  PM Created → Trading Phase → Resolution (Capital-Weighted) → Winners    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    REVENUE DISTRIBUTION                                  │
│                                                                          │
│  Pool → Distribute Revenue → Creator (50%) + Foundation (30%) + PM (20%)│
│         └── PM Pool → Winners (Proportional to Bets)                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Technical Components

### On-Chain Contracts

1. **`ad_campaigns.move`**: Campaign lifecycle management
2. **`ad_payments.move`**: Escrow, revenue pool, distribution
3. **`ad_tracking.move`**: Click token generation and verification
4. **`metadata_pm.move`**: ZK proof verification, Merkle trees, revenue distribution

### Off-Chain Services

1. **DGraph Service**: Event indexing, impression/click tracking, aggregation
2. **ZK Service**: Proof generation and verification
3. **Walrus Service**: Click gateway, consent enforcement
4. **Dgraph Service**: Prediction market creation and resolution (markets API)
5. **Sandbox Service**: Ad display, ZK proof generation

### Privacy Features

- **ZK Proofs**: Verify ad views without revealing viewer identity
- **Homomorphic Encryption**: Aggregate metrics without decrypting individual data
- **Merkle Trees**: Batch verification without individual attribution
- **Anonymous Tokens**: Click tokens are unlinkable and short-lived

---

## Revenue Model Summary

| Recipient | Percentage | Purpose |
|-----------|------------|---------|
| Content Creator | 50% | Reward for hosting/creating ad-eligible content |
| Foundation | 30% | Platform infrastructure, development, operations |
| PM Pool | 20% | Distributed to prediction market winners |

**PM Pool Distribution:**
- Winners receive stake + proportional share of losing pool
- Losers receive nothing
- Distribution is capital-weighted (most capital wins)

---

## Related Documentation

- [Ad Network System](./ad-network.md) - Overall ad network architecture
- [Ad Campaigns API](./contracts/ad-campaigns-api.md) - Campaign contract API
- [Ad Payments API](./contracts/ad-payments-api.md) - Payment and escrow API
- [Revenue Distribution](./contracts/revenue-distribution.md) - Revenue distribution details
- [Contract Architecture](./contracts/contract-architecture.md) - Complete contract overview

## E2E Coverage

| Journey | Spec | Browser |
|---------|------|---------|
| Ad campaign create/manage | `ad-campaigns.spec.ts` | no (API) |
| Ad clicks/conversions | `ad-clicks.spec.ts` | no (API) |
| Ad journey browser | `ad-journey-browser.spec.ts` | yes |
| Ad journey full (on-chain) | `ad-journey-full.spec.ts` | no (API+wallet) |
| Click bundling | `click-bundling-full.spec.ts` | yes |
| Ad settlement | `ad-settlement.spec.ts` | no (API) |
