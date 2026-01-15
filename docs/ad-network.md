# Ad Network System

## Overview

The ad network enables content creators to promote their posts and dApps, generating revenue for the platform while improving content discovery. Ads are treated as first-class content (posts and dApps) and are integrated seamlessly into the platform's discovery mechanisms.

## Key Features

1. **Content Promotion**: Any post or dApp can be promoted as an ad
2. **Pre-dApp Display**: Ads shown before users open dApps
3. **Algorithmic Feed Integration**: Ads intermixed in algorithmic feeds
4. **Ad Verification**: Two verification methods for ad engagement
5. **Community Feedback**: Ads trigger prediction markets for community moderation
6. **Revenue Sharing**: Ad revenue supports platform improvements and content creators

## Architecture Components

### Ad Service (New Service)

A dedicated ad service manages campaigns, impressions, and verification. This service should run on a new port (e.g., 3009).

**Responsibilities:**
- Campaign management (create, update, pause, resume)
- Ad selection and auction mechanism
- Impression tracking and verification
- Analytics and reporting
- Integration with PM service for ad quality markets

### Integration with Existing Services

#### Sandbox Service
- Displays pre-dApp ads before serving dApp content
- Sets cookies for cookie-based verification
- Reports checksums for checksum-based verification

#### DGraph Service
- Inserts ads into algorithmic feeds
- Calculates ad insertion points
- Tracks ad impressions in feed context

#### PM Service
- Creates prediction markets for ad quality
- Resolves markets based on engagement metrics
- Provides community feedback mechanism

#### SUI Service
- Stores ad campaign metadata on-chain (optional)
- Handles payment transactions for campaigns

## Ad Verification Methods

### Method 1: Cookie-Based Verification

**Use Case**: Best for dApp promotions where the sandbox service can set site-wide cookies.

**Process:**
1. When ad is displayed, sandbox service sets cookie: `dlux-paid-login={campaignId}:{timestamp}`
2. Cookie is set for domain: `.walrus.dlux.io` (site-wide)
3. dApp wrapper checks for cookie on load
4. If cookie exists and is valid, reports back to ad service
5. Ad service verifies cookie and marks impression as verified
6. Cookie expires after countdown period or session end

**Benefits:**
- Simple implementation
- Works across all dApps in sandbox
- No content modification needed

**Limitations:**
- Requires sandbox service control
- Cookie can be cleared by user
- Less granular than checksum method

### Method 2: Checksum-Based Verification

**Use Case**: Best for both post and dApp promotions requiring granular verification.

**Process:**
1. When ad content is downloaded, calculate SHA-256 checksum
2. Store checksum in ad verification record
3. Start countdown timer (e.g., 30 seconds)
4. dApp wrapper reports checksum back to ad service
5. Ad service verifies checksum matches expected value
6. If match and countdown hasn't expired, mark as verified

**Benefits:**
- More accurate verification
- Prevents cookie-based bypass
- Works for both posts and dApps
- Countdown ensures actual content download

**Limitations:**
- Requires dApp wrapper modification
- More complex implementation
- Countdown timing must be carefully calibrated

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
    - Start verification (cookie or checksum)
    ↓
User interacts with ad:
    - Click → Navigate to content
    - Dismiss → Proceed to dApp
    ↓
If cookie method:
    - Set cookie in sandbox
    - dApp wrapper verifies cookie
    - Report verification to ad service
    ↓
If checksum method:
    - Calculate content checksum
    - Start countdown
    - dApp wrapper reports checksum
    - Verify checksum and countdown
    ↓
Mark impression as verified
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
- **Resolution**: Based on engagement metrics and community bets

**Resolution Criteria:**
- Click-through rate (CTR) vs. platform average
- Conversion rate vs. platform average
- User engagement metrics
- Community feedback (market bets)
- Ad relevance score

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
   - Combines engagement metrics with market bets
   - Winners receive payouts

4. **Impact on Campaign**
   - High-quality resolution: Campaign continues, better placement
   - Low-quality resolution: Campaign may be paused, advertiser notified

## API Endpoints

### Ad Service (`http://localhost:3009`)

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
4. Basic cookie-based verification

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
