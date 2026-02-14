# Prediction Market User Journeys

## Overview

This document describes the complete user journeys for prediction markets (PM) on the DLUX platform, covering market entry (betting), market monitoring, market resolution, and exit (claiming payouts).

## Table of Contents

1. [PM Entry Journey - Betting on Markets](#pm-entry-journey)
2. [PM Monitoring Journey - Tracking Bets](#pm-monitoring-journey)
3. [PM Resolution Journey - Market Outcomes](#pm-resolution-journey)
4. [PM Exit Journey - Claiming Payouts](#pm-exit-journey)
5. [PM Creation Journey - Creating Markets](#pm-creation-journey)

---

## PM Entry Journey - Betting on Markets

### Overview

This journey covers how users discover prediction markets, analyze them, and place bets (enter markets).

### Step-by-Step Flow

#### 1. Discover Markets

**Via dApp Safety Review:**
- User views a dApp
- Sees safety status indicator (green/yellow/red)
- Clicks on safety status to view active markets
- Sees market details: metric, pool sizes, odds, time remaining

**Via Market Browser:**
- User navigates to `/markets` or market browser
- Views active markets across all dApps
- Filters by:
  - Safety metric (nsfw, malware, phishing, etc.)
  - Market status (open, resolving, resolved)
  - Pool size
  - Time remaining

**Via Profile:**
- User views their own or another user's profile
- Sees "Active Markets" section
- Views markets for user's dApps

#### 2. View Market Details

**Market Information Displayed:**
- **Safety Metric**: What's being reviewed (e.g., "nsfw", "malware")
- **dApp**: Link to the dApp being reviewed
- **Pool Sizes**: 
  - Safe pool: Total SUI bet on "safe"
  - Unsafe pool: Total SUI bet on "unsafe"
- **Current Odds**: Calculated from pool sizes
- **Status Color**: Green (safe winning), Yellow (close), Red (unsafe winning)
- **Time Remaining**: Days/hours until resolution
- **Recommended Age**: For age-restricted markets
- **Your Position**: If user has already bet, shows their bet amount and side

**Market Status Indicators:**
```
Green (Safe Winning):  ████████░░ 80% Safe
Yellow (Close):        ██████░░░░ 50% Safe
Red (Unsafe Winning):  ██░░░░░░░░ 20% Safe
```

#### 3. Analyze Market

**User Considers:**
- **dApp Content**: Reviews the actual dApp content
- **Market Odds**: Current distribution of bets
- **Time Remaining**: How much time for market to resolve
- **Pool Size**: Total liquidity in the market
- **Historical Data**: Previous markets for this dApp (if any)
- **Community Sentiment**: What other users are betting

**Decision Factors:**
- Personal assessment of dApp safety
- Market odds and potential payout
- Risk tolerance
- Market liquidity

#### 4. Place Bet (Enter Market)

**Betting Options:**
- **Side**: Choose "safe" or "unsafe"
- **Amount**: Enter SUI amount to bet (minimum: 0.1 SUI)
- **Age Range** (for age-restricted markets): Bet on specific age range

**Betting Process:**

1. **Select Side:**
   ```typescript
   // User clicks "Bet Safe" or "Bet Unsafe"
   const side = 'safe'; // or 'unsafe'
   ```

2. **Enter Bet Amount:**
   ```typescript
   const betAmount = 10; // SUI
   ```

3. **Review Bet Details:**
   - Side selected
   - Amount to bet
   - Estimated shares (calculated by CPMM)
   - Potential payout (if market resolves in favor)
   - Transaction fee

4. **Create On-Chain Transaction:**
   ```typescript
   const tx = new TransactionBlock();
   
   tx.moveCall({
     target: `${PACKAGE_ID}::prediction_markets::place_bet`,
     arguments: [
       tx.object(marketId),
       tx.pure(side), // 'safe' or 'unsafe'
       tx.pure(betAmount), // SUI amount
       tx.object(CLOCK_ID),
     ],
   });
   ```

5. **Sign and Execute:**
   - User signs transaction with wallet
   - Transaction submitted to Sui blockchain
   - Transaction confirmed

6. **Bet Recorded:**
   - Bet appears in market immediately
   - Pool sizes update
   - Odds recalculate
   - User's position shown in market

**On-Chain Actions:**
- SUI transferred from user to market pool
- Bet shares calculated using Constant Product Market Maker (CPMM)
- Market pool sizes updated
- Bet event emitted

**Off-Chain Actions:**
- DGraph indexes bet
- Market analytics updated
- User's bet history updated

#### 5. Confirm Entry

**Bet Confirmation:**
- Transaction digest displayed
- Bet details shown:
  - Side: "safe" or "unsafe"
  - Amount: 10 SUI
  - Shares: Calculated shares
  - Market: Link to market
  - Status: "Active"

**User Can Now:**
- View bet in "My Bets" section
- Monitor market progress
- See updated odds
- Track potential payout

---

## PM Monitoring Journey - Tracking Bets

### Overview

This journey covers how users monitor their active bets and market progress.

### Step-by-Step Flow

#### 1. View Active Bets

**Access Points:**
- Profile page → "My Bets" tab
- Market detail page → "Your Position" section
- Dashboard → "Active Markets" widget

**Bet Information Displayed:**
- **Market**: dApp and safety metric
- **Side**: Safe or Unsafe
- **Amount**: SUI bet
- **Shares**: Shares owned
- **Current Value**: Estimated current value of shares
- **Potential Payout**: Estimated payout if market resolves in favor
- **Time Remaining**: Days until resolution
- **Status**: Active, Resolving, Resolved

#### 2. Monitor Market Progress

**Real-Time Updates:**
- Pool sizes change as new bets are placed
- Odds recalculate automatically
- Status color updates (green/yellow/red)
- Time remaining countdown

**Market Analytics:**
- Total bets placed
- Number of unique bettors
- Average bet size
- Pool growth over time
- Bet distribution (safe vs unsafe)

#### 3. Track Position Value

**Position Tracking:**
- Initial bet amount
- Current estimated value (based on CPMM)
- Potential profit/loss
- ROI percentage

**Example:**
```
Initial Bet: 10 SUI on "safe"
Current Pool: Safe: 100 SUI, Unsafe: 50 SUI
Your Shares: 10% of safe pool
Current Value: ~10.5 SUI (if market resolves safe)
Potential Profit: +0.5 SUI (+5% ROI)
```

#### 4. Adjust Strategy (Optional)

**Users Can:**
- **Add More Bets**: Increase position in same market
- **Bet Opposite Side**: Hedge position (bet on both sides)
- **Wait for Resolution**: Hold position until market resolves

**Note:** Users cannot withdraw bets before market resolution. All bets are locked until resolution.

---

## PM Resolution Journey - Market Outcomes

### Overview

This journey covers how markets resolve and determine outcomes.

### Step-by-Step Flow

#### 1. Market Approaches Resolution

**Countdown:**
- Market shows "Resolving in X hours"
- Final bets can still be placed
- Pool sizes stabilize
- Final odds calculated

**Pre-Resolution:**
- Market status: "Resolving"
- No new bets accepted
- Final pool sizes locked
- Resolution logic executes

#### 2. Automatic Resolution

**Resolution Trigger:**
- Market duration expires (3 days for safety markets)
- On-chain resolution function called automatically
- Resolution based on pool sizes

**Resolution Logic:**
```typescript
// Resolution determined by capital-weighted outcome
if (safePool > unsafePool) {
  resolution = 'safe';
  winningPool = safePool;
  losingPool = unsafePool;
} else {
  resolution = 'unsafe';
  winningPool = unsafePool;
  losingPool = safePool;
}
```

**dApp Detail Page (Post-Resolution):**
After a market resolves, the dApp detail page at `dlux.io/dapps/{id}` shows:
- **Safe resolution**: "PM resolved as safe and accurate with N bettors (not the author)" and total capital (SUI)
- **Unsafe resolution**: "PM resolved as unsafe or inaccurate with N bettors" and total capital (SUI)
- No Place Bet button; an Explorer link is available to view the market on-chain.

**On-Chain Resolution:**
```move
// In prediction_markets.move
public fun resolve_market(
    market: &mut PredictionMarket,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // Check if market duration expired
    let now = clock.timestamp_ms();
    assert!(now >= market.end_at, E_MARKET_NOT_EXPIRED);
    
    // Determine resolution
    let resolution = if (market.safe_pool > market.unsafe_pool) {
        'safe'
    } else {
        'unsafe'
    };
    
    market.resolution = resolution;
    market.resolved_at = now;
    market.status = STATUS_RESOLVED;
    
    // Emit resolution event
    event::emit(MarketResolved {
        market_id: market.id.to_inner(),
        resolution,
        safe_pool: market.safe_pool,
        unsafe_pool: market.unsafe_pool,
    });
}
```

#### 3. Payout Calculation

**Winning Bettors:**
- Receive their stake back
- Plus proportional share of losing pool
- Payout = stake + (stake / winning_pool) * losing_pool

**Losing Bettors:**
- Receive nothing
- Their stake goes to winning pool

**Example Calculation:**
```
Market Resolution: "safe" wins
Safe Pool: 100 SUI
Unsafe Pool: 50 SUI
Your Bet: 10 SUI on "safe"

Your Payout = 10 + (10 / 100) * 50
            = 10 + 5
            = 15 SUI

Profit: +5 SUI (+50% ROI)
```

#### 4. Resolution Notification

**User Notifications:**
- Market resolved notification
- Payout available notification
- Email/In-app notification (if enabled)

**Resolution Display:**
- Market status: "Resolved - Safe" or "Resolved - Unsafe"
- Final pool sizes shown
- Resolution timestamp
- Link to claim payouts

---

## PM Exit Journey - Claiming Payouts

### Overview

This journey covers how users claim their winnings after market resolution.

### Step-by-Step Flow

#### 1. View Resolved Markets

**Access Points:**
- Profile → "My Bets" → "Resolved" tab
- Market browser → Filter by "Resolved"
- Dashboard → "Resolved Markets" widget

**Resolved Market Display:**
- Market details (dApp, metric, resolution)
- Your bet (side, amount)
- Your payout (calculated)
- Claim status (Available, Claimed)

#### 2. Review Payout Details

**Payout Information:**
- **Original Bet**: 10 SUI
- **Side**: Safe (won)
- **Payout Amount**: 15 SUI
- **Profit**: +5 SUI
- **ROI**: +50%
- **Claim Status**: Available to claim

**Multiple Markets:**
- If user has multiple resolved bets
- Shows total claimable amount
- Can claim individually or all at once

#### 3. Claim Payout

**Claim Process:**

1. **Select Markets to Claim:**
   - Individual market: Click "Claim" on specific market
   - Multiple markets: Select markets and click "Claim All"
   - All markets: Click "Claim All Payouts"

2. **Review Claim:**
   - Total payout amount
   - Number of markets
   - Transaction fee estimate

3. **Create Claim Transaction:**
   ```typescript
   const tx = new TransactionBlock();
   
   // For each resolved market with winning bet
   for (const marketId of resolvedMarkets) {
     tx.moveCall({
       target: `${PACKAGE_ID}::prediction_markets::claim_payout`,
       arguments: [
         tx.object(marketId),
         tx.object(CLOCK_ID),
       ],
     });
   }
   ```

4. **Sign and Execute:**
   - User signs transaction
   - Transaction submitted
   - Transaction confirmed

5. **Payout Received:**
   - SUI transferred to user's wallet
   - Claim status updated to "Claimed"
   - Transaction digest recorded

**On-Chain Actions:**
```move
// In prediction_markets.move
public fun claim_payout(
    market: &mut PredictionMarket,
    bet: &mut Bet,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // Verify market is resolved
    assert!(market.status == STATUS_RESOLVED, E_MARKET_NOT_RESOLVED);
    
    // Verify bet is winning side
    assert!(bet.side == market.resolution, E_BET_NOT_WINNING);
    
    // Verify payout not already claimed
    assert!(!bet.payout_claimed, E_PAYOUT_ALREADY_CLAIMED);
    
    // Calculate payout
    let winning_pool = if (market.resolution == 'safe') {
        market.safe_pool
    } else {
        market.unsafe_pool
    };
    
    let losing_pool = if (market.resolution == 'safe') {
        market.unsafe_pool
    } else {
        market.safe_pool
    };
    
    let payout = bet.amount + (bet.amount * losing_pool / winning_pool);
    
    // Transfer payout
    let payout_coin = coin::from_balance(
        balance::split(&mut market.payout_pool, payout),
        ctx
    );
    transfer::public_transfer(payout_coin, bet.bettor);
    
    // Mark as claimed
    bet.payout_claimed = true;
    
    // Emit event
    event::emit(PayoutClaimed {
        market_id: market.id.to_inner(),
        bettor: bet.bettor,
        payout,
    });
}
```

#### 4. Confirm Payout

**Payout Confirmation:**
- Transaction digest displayed
- Payout amount received
- Updated wallet balance
- Claim history updated

**User Can Now:**
- View payout in transaction history
- See updated balance
- Use SUI for new bets or other activities

---

## PM Creation Journey - Creating Markets

### Overview

This journey covers how markets are created (typically automatic, but users can flag dApps).

### Step-by-Step Flow

#### 1. Market Creation Triggers

**Automatic Creation:**
- **dApp Posting**: When dApp is posted, market created automatically
  - 50% of posting fee goes to market pool
  - Default metric: "nsfw" (or based on category)
  - Duration: 3 days

- **File Changes**: When dApp files are updated
  - New market created for "pen-test" metric
  - Re-tests dApp safety after changes

**User-Triggered Creation:**
- **Flag dApp**: User flags suspicious dApp
  - User navigates to dApp
  - Clicks "Flag" button
  - Selects safety metric (malware, phishing, scam, etc.)
  - Submits flag
  - Market created for selected metric

#### 2. Market Initialization

**Market Parameters:**
- **Safety Metric**: What's being reviewed
- **dApp ID**: Reference to dApp
- **Initial Pool**: 50% of posting fee (if from posting)
- **Duration**: 3 days (for safety markets)
- **Recommended Age**: Auto-set for NSFW/age-restricted markets

**On-Chain Creation:**
```move
// In prediction_markets.move
public fun create_market(
    dapp_id: vector<u8>,
    safety_metric: vector<u8>,
    initial_pool: u64,
    recommended_age: Option<u8>,
    clock: &Clock,
    ctx: &mut TxContext
): ID {
    let market_uid = object::new(ctx);
    let market_id = market_uid.to_inner();
    
    let market = PredictionMarket {
        id: market_uid,
        dapp_id,
        safety_metric,
        safe_pool: initial_pool / 2, // Split initial pool
        unsafe_pool: initial_pool / 2,
        recommended_age,
        status: STATUS_OPEN,
        created_at: clock.timestamp_ms(),
        end_at: clock.timestamp_ms() + MARKET_DURATION_MS,
        resolution: option::none(),
        resolved_at: 0,
    };
    
    event::emit(MarketCreated {
        market_id,
        dapp_id,
        safety_metric,
        initial_pool,
    });
    
    transfer::share_object(market);
    market_id
}
```

#### 3. Market Goes Live

**Market Activation:**
- Market status: "Open"
- Users can now place bets
- Market appears in market browser
- dApp shows safety status indicator

**Initial State:**
- Safe pool: 50% of initial pool
- Unsafe pool: 50% of initial pool
- Odds: 50/50
- Status: Yellow (neutral)

---

## Complete PM Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MARKET CREATION                                  │
│                                                                          │
│  dApp Posted → Market Created → Initial Pool → Market Open               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MARKET ENTRY (BETTING)                           │
│                                                                          │
│  User → Discover Market → Analyze → Place Bet → Bet Recorded            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MARKET MONITORING                                 │
│                                                                          │
│  User → View Active Bets → Monitor Progress → Track Position Value      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MARKET RESOLUTION                                │
│                                                                          │
│  Duration Expires → Auto-Resolve → Calculate Payouts → Market Resolved   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MARKET EXIT (CLAIM)                              │
│                                                                          │
│  User → View Resolved Markets → Claim Payout → SUI Received             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Technical Components

### On-Chain Contracts

1. **`prediction_markets.move`**: Market lifecycle, betting, resolution, payouts
2. **Market Objects**: Shared objects for market state
3. **Bet Objects**: User-owned objects representing bets

### Off-Chain Services

1. **Dgraph Service**: Market management, analytics, API (markets routes)
2. **DGraph Service**: Market indexing, bet history, analytics
3. **SUI Service**: Transaction creation, market creation triggers

### Market Types

1. **Safety Markets**: dApp safety reviews (nsfw, malware, etc.)
2. **Ad Quality Markets**: Ad campaign quality reviews
3. **Governance Markets**: Platform parameter changes

---

## Related Documentation

- [Moderation System](./moderation-system.md) - Technical details of PM system
- [Architecture Overview](./architecture-overview.md) - System architecture
- [Developer Guide](./developer-guide.md) - API reference

## E2E Coverage

| Journey | Spec | Browser |
|---------|------|---------|
| dApp + PM journey | `dapp-pm-journey.spec.ts` | yes (API+browser) |
| PM markets API | `pm-markets.spec.ts` | no (API) |
| Revenue distribution | `revenue-distribution-full.spec.ts` | yes |
| On-chain dApp posting | `dapp-posting-onchain.spec.ts` | no (wallet tx) |
