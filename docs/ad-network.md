# Ad Network System

## Overview

The ad network enables content creators to promote their posts and dApps, generating revenue for the platform while improving content discovery. Ads are treated as first-class content (posts and dApps) and are integrated seamlessly into the platform's discovery mechanisms.

## Key Features

1. **Content Promotion**: Any post or dApp can be promoted as an ad
2. **Pre-dApp Display**: Ads shown before users open dApps
3. **Algorithmic Feed Integration**: Ads intermixed in algorithmic feeds
4. **Ad Verification**: ZK proofs + homomorphic analytics for privacy-preserving verification
5. **Community Feedback**: Ads trigger prediction markets for community moderation
6. **Revenue Sharing**: Ad revenue supports platform improvements and content creators

## Architecture Components

### Ad Service (New Service)

A dedicated ad service manages campaigns, impressions, and verification. This service should run on a new port (e.g., 3013).

**Responsibilities:**
- Campaign management (create, update, pause, resume)
- Ad selection and auction mechanism
- Impression tracking and verification
- Analytics and reporting
- Integration with PM service for ad quality markets

### Integration with Existing Services

#### Sandbox Service
- Displays pre-dApp ads before serving dApp content
- Gates content behind signed "Continue to Content" action
- Generates ZK proofs for ad views (viewer identity hidden)

#### DGraph Service
- Inserts ads into algorithmic feeds
- Calculates ad insertion points
- Tracks privacy-preserving ad impressions (ZK proofs)
- Stores Merkle roots for batch verification

#### Walrus Service (Gateway)
- Routes **all ad clicks** through `/ads/click` for click-through tracking
- Issues anonymized click tokens for conversion proof linkage
- Enforces explicit consent before tracking

#### Dgraph Service (markets)
- Creates prediction markets for ad quality
- Resolves markets purely by capital-weighted outcome (most capital wins)
- Provides community feedback mechanism (labels that can affect placement/eligibility)

#### SUI Service
- Stores ad campaign metadata on-chain (optional)
- Handles payment transactions for campaigns

## Ad Verification Methods

### Zero-Knowledge (ZK) Verification

**Use Case**: Default for privacy-first ad verification across dApps and posts.

**Process:**
1. Sandbox displays ad before content access
2. User clicks **Continue to Content**
3. Client generates a ZK proof for the ad view:
   - Proof binds ad + content + block header
   - Viewer identity is used as a private witness (not revealed)
4. Client submits ZK proof to DGraph impression API
5. DGraph stores proof hash and encrypted viewer data for aggregation
6. Merkle tree built after threshold (e.g., 100 proofs)
7. Move contract verifies Merkle root and distributes revenue

**Benefits:**
- Viewer identity never revealed
- Cryptographically verifiable ad views
- On-chain verification without leaking user data

### Click-Through + Conversion (ZK)

**Click-Through Flow:**
1. Ad click redirects to `walrus.dlux.io/ads/click`
2. Gateway enforces consent and generates ZK click proof
3. DGraph records click with proof hash + encrypted viewer
4. Gateway redirects to target with `dlux_click` token

**Conversion Flow:**
1. Advertiser redirects conversion to `walrus.dlux.io/ads/convert`
2. Gateway verifies click token and generates ZK conversion proof
3. DGraph records conversion (no identity revealed)

**Benefits:**
- Full CTR + conversion metrics without user identification
- Consent enforced at gateway
- Tokens are anonymous, short-lived, and unlinkable

### Homomorphic Aggregation

**Use Case**: Aggregate ad metrics without decrypting individual views.

**Process:**
1. Each ad view encrypts a `1` using Paillier
2. DGraph aggregates encrypted counts with homomorphic addition
3. Foundation/admin can decrypt total counts only (no individual data)

**Benefits:**
- GDPR-friendly analytics
- No raw viewer data stored
- Aggregate stats remain verifiable

## Ad Display Logic

### Pre-dApp Display Flow

```
User clicks dApp
    ↓
Sandbox service checks for active ads
    ↓
If ads exist:
    - Run auction (select highest bid)
    - Display ad overlay/modal
    - Create impression record
    - Start verification (ZK proof)
    ↓
User interacts with ad:
    - Click → Navigate to content
    - Dismiss → Proceed to dApp
    ↓
Generate ZK proof:
    - Bind ad + content + block header
    - Viewer identity is private witness
    - Submit proof to DGraph
    ↓
Merkle batch verification:
    - Build Merkle tree at threshold
    - Verify on-chain
    - Distribute revenue
```

### Algorithmic Feed Integration Flow

```
Generate base feed (trending/following/etc.)
    ↓
Query active ads for feed-algorithmic placement
    ↓
Calculate insertion points:
    - Ad bid amount
    - User targeting match score
    - Content relevance
    - Ad frequency caps
    ↓
Insert ads at calculated positions (e.g., every 5-10 posts)
    ↓
Mark ads clearly as "Promoted" or "Sponsored"
    ↓
Track impressions as user scrolls
    ↓
Start verification based on campaign method
    ↓
Record engagement (clicks, views, conversions)
```

## Ad Auction Mechanism

### Selection Criteria

Ads are selected using a weighted auction system:

1. **Bid Amount**: Higher bids have priority
2. **Targeting Match**: Ads matching user profile score higher
3. **Campaign Performance**: Higher CTR/conversion rates score higher
4. **Budget Remaining**: Campaigns with more budget score higher
5. **Frequency Capping**: Respect user ad frequency limits

### Auction Formula

```
Score = (bid × targetingMatch × performanceMultiplier) / frequencyPenalty
```

Where:
- `bid`: Maximum bid per impression
- `targetingMatch`: 0.0-1.0 based on how well ad matches user
- `performanceMultiplier`: 1.0-2.0 based on historical performance
- `frequencyPenalty`: 1.0+ based on how often user has seen this ad

## Prediction Market Integration

### Ad Quality Markets

When an ad campaign is created, a prediction market is automatically created:

**Market Parameters:**
- **Safety Metric**: `ad-quality` (new metric type)
- **Market Pool**: 5-10% of campaign budget
- **Duration**: 7 days (longer than content markets)
- **Resolution**: Capital-weighted only (most capital wins)

**Resolution Inputs:**
- Community betting only (capital-weighted)
- Engagement metrics (CTR/conversion) may be displayed as *informational signals* but **do not** resolve the market

**Impact:**
- High-quality ads: Better placement, lower costs
- Low-quality ads: Deprioritized, may be paused
- Advertiser reputation: Affects future campaign eligibility

### Community Feedback Process

1. **Market Creation**
   - Automatic when campaign starts
   - Initial pool from campaign budget
   - Users can bet on ad quality

2. **Trading Phase**
   - Users bet on "high-quality" or "low-quality"
   - Market odds reflect community sentiment
   - Ad performance data feeds into market

3. **Resolution**
   - After 7 days, market resolves
   - Resolution is purely capital-weighted (most capital wins)
   - Winners receive payouts

4. **Impact on Campaign**
   - High-quality resolution: Campaign continues, better placement
   - Low-quality resolution: Campaign may be paused, advertiser notified

## API Endpoints

### Ad Service (`http://localhost:3013`)

#### Campaigns
- `POST /campaigns` - Create ad campaign
- `GET /campaigns` - List campaigns (with filters)
- `GET /campaigns/:id` - Get campaign details
- `PUT /campaigns/:id` - Update campaign
- `POST /campaigns/:id/pause` - Pause campaign
- `POST /campaigns/:id/resume` - Resume campaign
- `DELETE /campaigns/:id` - Cancel campaign

#### Ads
- `GET /ads/active` - Get active ads for placement
  - Query params: `placement`, `userId`, `targetAudience`
- `POST /ads/select` - Select ad via auction
  - Body: `{ placement, userId, context }`
  - Returns: Selected ad or null

#### Impressions
- `POST /impressions` - Create impression
- `GET /impressions/:id` - Get impression details
- `POST /impressions/:id/verify` - Verify impression
  - Body: `{ method, cookieValue?, checksum? }`
- `POST /impressions/:id/click` - Record click
- `POST /impressions/:id/convert` - Record conversion
- `GET /impressions` - List impressions (with filters)

#### Analytics
- `GET /analytics/campaign/:id` - Get campaign analytics
  - Returns: impressions, clicks, conversions, spend, CTR, etc.
- `GET /analytics/advertiser/:address` - Get advertiser analytics
- `GET /analytics/platform` - Get platform-wide ad analytics

## Data Schemas

See [architecture-overview.md](./architecture-overview.md) for complete schema definitions:
- `AdCampaign`
- `AdPlacement`
- `AudienceTarget`
- `AdImpression`
- `AdVerification`

## Implementation Considerations

### Phase 1: Core Infrastructure
1. Create ad service with basic campaign management
2. Implement impression tracking
3. Integrate with sandbox service for pre-dApp ads
4. Configure MVP inventory via `AD_INVENTORY_JSON` in the dGraph service
5. Basic cookie-based verification

### Phase 2: Feed Integration
1. Integrate with DGraph service for feed ads
2. Implement ad insertion algorithm
3. Add frequency capping
4. Implement checksum-based verification

### Phase 3: Advanced Features
1. Implement auction mechanism
2. Add targeting options
3. Integrate with PM service for ad quality markets
4. Add analytics dashboard

### Phase 4: Optimization
1. Machine learning for ad selection
2. Advanced targeting algorithms
3. A/B testing framework
4. Revenue optimization

## Security Considerations

1. **Ad Fraud Prevention**
   - Rate limiting on impression creation
   - Verification methods prevent fake impressions
   - Cookie/checksum validation
   - Countdown timers prevent instant verification
   - IP-based fraud detection

2. **Privacy**
   - User targeting respects privacy preferences
   - Anonymous impression tracking when possible
   - Cookie data minimized
   - GDPR compliance for ad tracking
   - Opt-out mechanisms

3. **Content Safety**
   - Ads go through same moderation as regular content
   - Prediction markets provide community oversight
   - Low-quality ads can be flagged and paused
   - Advertiser reputation system

4. **Financial Security**
   - Budget limits prevent overspending
   - Daily budget caps
   - Payment verification before campaign activation
   - Refund policies for cancelled campaigns
   - Secure payment processing

## MVP Inventory Configuration

For the MVP, the dGraph service can serve a minimal ad inventory without a
dedicated ad service. Configure the JSON inventory via `AD_INVENTORY_JSON`:

```
[
  {
    "id": "ad_1",
    "title": "Try DLUX Pro",
    "description": "Unlock premium tools",
    "targetUrl": "https://dlux.io/pricing",
    "placements": ["gate"],
    "contentIds": [],
    "startAt": "2025-01-01T00:00:00Z",
    "endAt": "2026-01-01T00:00:00Z"
  }
]
```

Active ads are selected by `GET /ads/active?placement=gate&contentId=...` and
used by the sandbox service to gate dApp access with the ad overlay.

If no inventory is configured, a default DLUX subscription ad is returned
for testing. Override the copy or disable it via:
`AD_DEFAULT_ENABLED`, `AD_DEFAULT_TITLE`, `AD_DEFAULT_DESCRIPTION`,
`AD_DEFAULT_TARGET_URL`.

## Revenue Model

### Cost Structure
- **Cost Per Impression (CPI)**: Advertisers pay per impression shown
- **Auction-Based Pricing**: Highest bid wins
- **Minimum Bid**: Ensures quality (e.g., 0.001 SUI per impression)

### Revenue Distribution
- **Platform Fee**: 30% (supports system improvements)
- **Content Creator Share**: 50% (if promoting someone else's content)
- **Prediction Market Pool**: 10% (for ad quality markets)
- **Reserve**: 10% (for future features, refunds, etc.)

### Ad Shares
- Advertisers can share revenue directly with content creators
- Enables direct payment to content creators
- Supports ecosystem growth
- Can be configured per campaign

## Ad Pool & Revenue Distribution

### Ad Pool Mechanism

When verified ad impressions and clicks reach aggregation thresholds, they are bundled and sold into the **ad pool**. The ad pool distributes revenue according to this priority order:

1. **Open PM Markets**: If a dApp has active prediction markets, ad revenue first goes to the PM pool to incentivize safety reviews
2. **Creator Share**: Remaining revenue goes to the dApp creator
3. **Platform Fee**: Platform takes a percentage cut for infrastructure costs

### Storage Funding Integration

Ad revenue plays a critical role in **storage funding** for Walrus-hosted dApps:

- **Term Structure**: Walrus storage is purchased in 2-year terms
- **Funding Timeline**: Ads only contribute to storage costs after 50% of the term has elapsed
- **Precarious Status**: If >75% through term but <100% funded, dApp enters "precarious" status
- **Auto-Renewal**: If storage costs are fully covered by term end, dApp auto-renews
- **Expiration**: If insufficient funding, dApp gracefully expires

#### Funding Sources (in priority order)
1. **PM Fees**: Always applied first (cover posting costs)
2. **Ad Revenue**: Applied after 50% term progress
3. **Manual Payments**: Direct SUI payments to extend terms

### Revenue Flow Example

```
Ad Impression → ZK Verification → Threshold Aggregation → Ad Pool Sale
    ↓
PM Pool (if open markets) → Creator Share → Platform Fee
    ↓
Storage Funding Pool → Walrus Term Renewal
```

## Billing & Payouts

### Available Endpoints

- `GET /billing/overview?owner=...` - Complete billing overview
- `POST /billing/claim` - Claim SUI payouts to wallet
- `GET /billing/storage/:dappId/:blobId` - Storage funding status

### Payout Buckets

Revenue flows into a single **ad-share account** (pool). Programmatic amounts (gas, Walrus fees, contract/server fees) are funded first; then 90% of subscription revenue and ad revenue feed this pool. When creators **draw down** their ad-share credits, they receive both ad-derived and subscriber-derived share. Providers get **signed statements** (Brave-like): **ad statement** (share from verified impressions/clicks) and **subscriber statement** (subscription share per person/time), so it directly affects creators.

- **Ad Share**: Creator's portion from the ad-share pool (includes ad + subscription share when drawn down).
- **Subscription Share**: Subscription-derived share in the same ad-share pool (creators get this when they draw down ad share).
- **PM Share**: Earnings from prediction market participation

### Storage Status Indicators

- **Green**: Fully funded, auto-renewal enabled
- **Yellow**: Partially funded, monitoring required
- **Red**: Precarious, at risk of expiration

## Future Enhancements

1. **Advanced Targeting**
   - Behavioral targeting
   - Retargeting
   - Lookalike audiences
   - Geographic targeting

2. **Ad Formats**
   - Video ads
   - Interactive ads
   - Rich media ads
   - Native ad formats

3. **Optimization**
   - Automatic bid optimization
   - Budget optimization
   - Schedule optimization
   - Audience optimization

4. **Analytics**
   - Real-time dashboards
   - Attribution tracking
   - Conversion funnels
   - ROI reporting

5. **Advertiser Tools**
   - Campaign templates
   - Bulk campaign management
   - API access
   - White-label solutions

## Related

- **[Webhook Messaging & Escrow](./webhook-messaging-escrow.md)** — Design for user-registered keys, messages that unlock escrow (individualized ads, direct messenger), prorata release by watch progress, and dApp webhooks for push/pull notifications.
