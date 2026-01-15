# Moderation System with Prediction Markets

## Overview

The moderation system uses prediction markets to crowdsource safety verification for dApps. When a dApp is posted, 50% of the posting fee goes into a prediction market that resolves after 3 days based on market bets.

## Architecture

### Components

1. **Prediction Market Service** (`pm-service`) - Port 3008
   - Manages prediction markets
   - Handles betting and resolution
   - Provides safety status API

2. **SUI Service Integration**
   - Creates markets when dApps are posted
   - Splits posting fee (50% to market, 50% to platform)
   - Creates markets when dApp files change

3. **Sandbox Service Integration**
   - Checks safety status before serving dApps
   - Displays warnings for dApps with active markets
   - Shows color-coded status (green/yellow/red)
   - **Age Confirmation Dialogs** for NSFW/age-restricted content
   - **GDPR Cookie Banners** for GDPR-related markets

## Safety Metrics

The system tracks the following safety metrics:

- `nsfw` - Not Safe For Work content (triggers age confirmation)
- `age-restricted` - Age-restricted content (triggers age confirmation with specific age)
- `pen-test` - Penetration testing results
- `gdpr-compliance` - GDPR cookie banner compliance (triggers GDPR banner)
- `cookie-banner` - Cookie consent banner presence (triggers GDPR banner)
- `malware` - Malicious software detection
- `phishing` - Phishing attempts
- `scam` - Scam indicators
- `other` - Other safety concerns

## User Experience Features

### Age Confirmation Dialog

When a dApp has active markets for `nsfw` or `age-restricted` metrics:

- **Full-screen modal dialog** appears before content loads
- Shows the highest recommended age from all active markets
- User must confirm they meet the age requirement
- Confirmation stored in `sessionStorage` (per session)
- If user declines, they are redirected away

**Example:**
- Market with `nsfw` → Shows "I am 18 or older" dialog
- Market with `age-restricted` and `recommendedAge: "21+"` → Shows "I am 21 or older" dialog

### GDPR Cookie Banner

When a dApp has active markets for `gdpr-compliance` or `cookie-banner`:

- **Non-blocking banner** appears at the bottom of the page
- User can accept or decline cookies
- Preference stored in `localStorage` (persists across sessions)
- Banner can be dismissed without blocking content
- Does not prevent dApp from loading

## Market Lifecycle

1. **Creation**
   - Triggered by: dApp posting, file change, or user flag
   - Initial pool: 50% of posting fee (if from posting)
   - Duration: 3 days
   - Age rating: Automatically set for NSFW/age-restricted markets

2. **Trading**
   - Users can bet on "safe" or "unsafe"
   - Uses Constant Product Market Maker (CPMM) for pricing
   - Shares calculated based on pool size
   - Users can bet on recommended age ranges

3. **Resolution**
   - After 3 days, market resolves automatically
   - Resolution based on which side has more total value
   - If `safePool > unsafePool` → resolution = "safe"
   - Otherwise → resolution = "unsafe"
   - For age-restricted markets, resolution determines the final recommended age

4. **Payouts**
   - Winning bettors receive proportional payouts
   - Payout = bet amount + (bet amount / winning pool) * losing pool
   - Losing bettors receive nothing

## Status Colors

- **Green**: Safe side is winning (>60% of pool)
- **Yellow**: Close market (40-60% split)
- **Red**: Unsafe side is winning (>60% of pool)
- **Gray**: No active markets

## API Endpoints

### Prediction Market Service

#### Markets
- `POST /markets` - Create market
- `POST /markets/:marketId/bets` - Place bet
- `GET /markets/:marketId/status` - Get market status
- `POST /markets/:marketId/resolve` - Resolve market
- `GET /markets/dapp/:dappId` - Get markets for dApp

#### Safety
- `GET /safety/dapp/:dappId` - Get safety status
- `POST /safety/flag` - Flag a dApp

## Integration Points

### SUI Service

When a dApp is posted:

```typescript
// In dappProcessor.ts or dapps route
const postingFee = 100; // SUI
const marketContribution = postingFee * 0.5; // 50%

await pmService.createMarket({
  dappId: dapp.id,
  safetyMetric: 'nsfw', // Default or based on category
  recommendedAge: '18+', // Optional, auto-set for nsfw
  postingFeeContribution: marketContribution,
  triggeredBy: 'posting',
  triggeredByAddress: dapp.owner
});
```

When dApp files change:

```typescript
await pmService.createMarket({
  dappId: dapp.id,
  safetyMetric: 'pen-test', // Re-test after changes
  triggeredBy: 'file-change',
  triggeredByAddress: dapp.owner
});
```

### Sandbox Service

Before serving a dApp:

```typescript
const safety = await axios.get(`${PM_SERVICE}/safety/dapp/${dappId}`);
if (safety.activeMarkets.length > 0) {
  // Check for age-restricted markets
  const ageMarkets = safety.activeMarkets.filter(m => 
    m.safetyMetric === 'nsfw' || m.safetyMetric === 'age-restricted'
  );
  
  // Check for GDPR markets
  const gdprMarkets = safety.activeMarkets.filter(m => 
    m.safetyMetric === 'gdpr-compliance' || m.safetyMetric === 'cookie-banner'
  );
  
  // Display appropriate dialogs/banners
}
```

## Age Rating System

Markets can specify a `recommendedAge` field:

- `all` - No age restriction
- `13+` - Teen content
- `16+` - Mature teen content
- `18+` - Adult content (default for NSFW)
- `21+` - Restricted adult content

The sandbox service will:
1. Find the highest age requirement from all active markets
2. Show age confirmation dialog with that age
3. Block content until user confirms

## GDPR Compliance

For GDPR-related markets:

1. **Cookie Banner** appears at bottom of page
2. **Non-blocking** - user can continue using dApp
3. **Accept/Decline** options
4. **Preference stored** in localStorage
5. **Banner can be dismissed** and won't reappear for that dApp

## Market Resolution Logic

Markets resolve automatically after 3 days. The resolution is determined by:

1. Compare `safePool` vs `unsafePool`
2. If `safePool > unsafePool` → resolution = "safe"
3. Otherwise → resolution = "unsafe"

This ensures the market consensus determines the outcome.

## Future Enhancements

1. **Multiple Markets**: Allow multiple markets for different metrics simultaneously
2. **Reputation System**: Weight bets by user reputation
3. **Expert Reviewers**: Designated reviewers with higher weight
4. **Appeal Process**: Allow dApp creators to appeal resolved markets
5. **Market History**: Track all resolved markets for transparency
6. **Automated Testing**: Integrate with automated security scanners
7. **Age Verification**: Integrate with identity verification services
8. **Cookie Preferences**: Detailed cookie preference management

## Security Considerations

1. **Sybil Resistance**: Consider requiring minimum stake or reputation
2. **Market Manipulation**: Monitor for coordinated betting
3. **Front-running**: Use commit-reveal scheme for bets
4. **Oracle Problem**: Consider adding trusted oracles for certain metrics
5. **Age Verification**: Session-based confirmation prevents easy bypass
6. **GDPR Compliance**: Ensure cookie preferences are properly respected
