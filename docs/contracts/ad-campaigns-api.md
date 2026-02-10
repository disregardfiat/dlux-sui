# Ad Campaigns Contract API

**Module:** `dlux::ad_campaigns`  
**Location:** `contracts/metadata_pm/sources/ad_campaigns.move`

## Overview

The Ad Campaigns contract manages the complete lifecycle of advertising campaigns on the DLUX platform. It handles campaign creation, updates, status management, and impression cost deduction.

## Structs

### AdCampaign

The main campaign object stored on-chain.

```move
public struct AdCampaign has key, store {
    id: UID,
    advertiser: address,          // Campaign owner
    title: vector<u8>,            // Campaign title
    description: vector<u8>,       // Campaign description
    target_url: vector<u8>,        // Landing page URL
    placements: vector<vector<u8>>, // Placement types: ["gate", "slip", "install"]
    bid: u64,                      // Cost per impression (in MIST)
    total_budget: u64,             // Total campaign budget
    remaining_budget: u64,         // Remaining budget
    status: u8,                    // Campaign status
    start_at: u64,                 // Start timestamp (ms)
    end_at: u64,                   // End timestamp (ms)
    created_at: u64,               // Creation timestamp (ms)
    impression_count: u64,         // Total impressions served
    // Targeting fields
    user_zones: vector<vector<u8>>, // GeoIP targeting zones (e.g., ["US", "EU", "ASIA"])
    content_zones: vector<vector<u8>>, // Content location zones for targeting
    planet: Option<u8>,             // 0=Earth, 1=Moon, 2=Mars (optional for digital twin)
    escrow_id: Option<ID>,         // Reference to CampaignEscrow holding funds
}
```

### Status Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `STATUS_ACTIVE` | 0 | Campaign is running |
| `STATUS_PAUSED` | 1 | Campaign manually paused |
| `STATUS_CANCELLED` | 2 | Campaign cancelled by advertiser |
| `STATUS_EXPIRED` | 3 | Campaign past end date |
| `STATUS_BUDGET_DEPLETED` | 4 | Budget exhausted |

## Events

### CampaignCreated

Emitted when a new campaign is created.

```move
public struct CampaignCreated has copy, drop {
    campaign_id: ID,
    advertiser: address,
    title: vector<u8>,
    bid: u64,
    total_budget: u64,
}
```

### CampaignUpdated

Emitted when campaign details are modified.

```move
public struct CampaignUpdated has copy, drop {
    campaign_id: ID,
    title: vector<u8>,
    description: vector<u8>,
    target_url: vector<u8>,
}
```

### CampaignStatusChanged

Emitted on status transitions.

```move
public struct CampaignStatusChanged has copy, drop {
    campaign_id: ID,
    old_status: u8,
    new_status: u8,
}
```

### ImpressionRecorded

Emitted when an impression is served and charged.

```move
public struct ImpressionRecorded has copy, drop {
    campaign_id: ID,
    cost: u64,
    remaining_budget: u64,
}
```

### CampaignCancelled

Emitted when campaign is cancelled.

```move
public struct CampaignCancelled has copy, drop {
    campaign_id: ID,
    refund_amount: u64,
}
```

## Functions

### create_campaign_entry

Entry function to create a new ad campaign with escrow and targeting.

```move
public entry fun create_campaign_entry(
    payment: Coin<SUI>,
    title: vector<u8>,
    description: vector<u8>,
    target_url: vector<u8>,
    placements: vector<vector<u8>>,
    bid: u64,
    start_at: u64,
    end_at: u64,
    user_zones: vector<vector<u8>>,
    content_zones: vector<vector<u8>>,
    planet: Option<u8>,
    lock_duration_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext
)
```

**Parameters:**
- `payment`: SUI coin for campaign budget (properly escrowed)
- `title`: Campaign title (bytes)
- `description`: Campaign description (bytes)
- `target_url`: Landing page URL (bytes)
- `placements`: Array of placement types (e.g., `["gate", "slip"]`)
- `bid`: Cost per impression in MIST
- `start_at`: Campaign start timestamp (milliseconds)
- `end_at`: Campaign end timestamp (milliseconds)
- `user_zones`: GeoIP targeting zones (e.g., `["US", "EU", "ASIA"]`)
- `content_zones`: Content location zones for targeting
- `planet`: Optional planet identifier (0=Earth, 1=Moon, 2=Mars) for digital twin support
- `lock_duration_ms`: Escrow lock duration in milliseconds
- `clock`: Sui Clock object
- `ctx`: Transaction context

**Effects:**
- Creates shared `AdCampaign` object
- Creates `CampaignEscrow` and properly escrows payment (not frozen)
- Links campaign to escrow via `escrow_id`
- Emits `CampaignCreated` event

**Errors:**
- `E_INVALID_BUDGET` (6): Payment is zero
- `E_INVALID_BID` (5): Bid is zero
- `E_INVALID_DATES` (7): End date before start date or in the past

### update_campaign

Updates campaign details. Only the advertiser can update.

```move
public fun update_campaign(
    campaign: &mut AdCampaign,
    title: vector<u8>,
    description: vector<u8>,
    target_url: vector<u8>,
    ctx: &TxContext
)
```

**Parameters:**
- `campaign`: Mutable reference to campaign
- `title`: New title
- `description`: New description
- `target_url`: New landing page URL
- `ctx`: Transaction context (for sender verification)

**Effects:**
- Updates campaign fields
- Emits `CampaignUpdated` event

**Errors:**
- `E_NOT_ADVERTISER` (1): Caller is not the advertiser
- `E_CAMPAIGN_CANCELLED` (10): Campaign is cancelled

### pause_campaign

Pauses an active campaign.

```move
public fun pause_campaign(
    campaign: &mut AdCampaign,
    ctx: &TxContext
)
```

**Effects:**
- Sets status to `STATUS_PAUSED`
- Emits `CampaignStatusChanged` event

**Errors:**
- `E_NOT_ADVERTISER` (1): Caller is not the advertiser
- `E_ALREADY_PAUSED` (8): Campaign not active

### resume_campaign

Resumes a paused campaign.

```move
public fun resume_campaign(
    campaign: &mut AdCampaign,
    clock: &Clock,
    ctx: &TxContext
)
```

**Effects:**
- Sets status to `STATUS_ACTIVE`
- Emits `CampaignStatusChanged` event

**Errors:**
- `E_NOT_ADVERTISER` (1): Caller is not the advertiser
- `E_ALREADY_ACTIVE` (9): Campaign not paused
- `E_INVALID_DATES` (7): Campaign expired
- `E_INSUFFICIENT_BUDGET` (4): Budget less than bid

### cancel_campaign

Cancels campaign and marks for refund.

```move
public fun cancel_campaign(
    campaign: &mut AdCampaign,
    ctx: &TxContext
)
```

**Effects:**
- Sets status to `STATUS_CANCELLED`
- Sets remaining_budget to 0
- Emits `CampaignStatusChanged` and `CampaignCancelled` events

**Note:** Actual SUI refund is handled by the escrow contract.

**Errors:**
- `E_NOT_ADVERTISER` (1): Caller is not the advertiser
- `E_CAMPAIGN_CANCELLED` (10): Already cancelled

### record_impression_with_escrow

Entry function that records an impression, deducts from campaign budget, and withdraws from escrow to revenue pool.

```move
public entry fun record_impression_with_escrow(
    campaign: &mut AdCampaign,
    escrow: &mut CampaignEscrow,
    pool: &mut RevenuePool,
    admin: &AdminCap,
    clock: &Clock,
): bool
```

**Parameters:**
- `campaign`: Mutable reference to campaign
- `escrow`: Mutable reference to campaign escrow
- `pool`: Mutable reference to revenue pool
- `admin`: Admin capability for escrow operations
- `clock`: Sui Clock object

**Returns:** `true` if successful, `false` otherwise.

**Effects (on success):**
- Deducts bid from campaign remaining_budget
- Withdraws bid from escrow to revenue pool
- Increments impression_count
- May set status to `STATUS_BUDGET_DEPLETED` or `STATUS_EXPIRED`
- Emits `ImpressionRecorded` event

**Returns false when:**
- Campaign not active
- Current time outside start_at/end_at range
- Insufficient budget for bid
- Escrow withdrawal fails

### deduct_impression_cost

Internal function that deducts the bid amount from campaign budget (does not handle escrow).

```move
public fun deduct_impression_cost(
    campaign: &mut AdCampaign,
    clock: &Clock,
): bool
```

**Returns:** `true` if deduction successful, `false` otherwise.

**Effects (on success):**
- Deducts bid from remaining_budget
- Increments impression_count
- May set status to `STATUS_BUDGET_DEPLETED` or `STATUS_EXPIRED`
- Emits `ImpressionRecorded` event

**Note:** This function only updates campaign state. Actual fund withdrawal from escrow must be done separately via `ad_payments::withdraw_for_impression`.

**Returns false when:**
- Campaign not active
- Current time outside start_at/end_at range
- Insufficient budget for bid

## View Functions

### get_status

```move
public fun get_status(campaign: &AdCampaign): u8
```

Returns the current campaign status.

### get_remaining_budget

```move
public fun get_remaining_budget(campaign: &AdCampaign): u64
```

Returns remaining budget in MIST.

### get_bid

```move
public fun get_bid(campaign: &AdCampaign): u64
```

Returns the bid amount per impression.

### get_advertiser

```move
public fun get_advertiser(campaign: &AdCampaign): address
```

Returns the advertiser's address.

### get_impression_count

```move
public fun get_impression_count(campaign: &AdCampaign): u64
```

Returns total impressions served.

### is_active_with_budget

```move
public fun is_active_with_budget(campaign: &AdCampaign, clock: &Clock): bool
```

Returns `true` if campaign is active, within date range, and has sufficient budget.

### get_user_zones

```move
public fun get_user_zones(campaign: &AdCampaign): vector<vector<u8>>
```

Returns the GeoIP targeting zones for user targeting.

### get_content_zones

```move
public fun get_content_zones(campaign: &AdCampaign): vector<vector<u8>>
```

Returns the content location zones for content targeting.

### get_planet

```move
public fun get_planet(campaign: &AdCampaign): Option<u8>
```

Returns the planet identifier (0=Earth, 1=Moon, 2=Mars) if set.

### get_escrow_id

```move
public fun get_escrow_id(campaign: &AdCampaign): Option<ID>
```

Returns the escrow ID linked to this campaign.

## Usage Examples

### Creating a Campaign

```typescript
// Off-chain: sui-service
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::ad_campaigns::create_campaign_entry`,
  arguments: [
    tx.object(paymentCoinId),           // SUI payment (escrowed)
    tx.pure(Buffer.from("My Campaign")), // title
    tx.pure(Buffer.from("Description")), // description
    tx.pure(Buffer.from("https://example.com")), // target_url
    tx.pure([Buffer.from("gate")]),      // placements
    tx.pure(1000000),                    // bid: 0.001 SUI
    tx.pure(startTimestamp),             // start_at
    tx.pure(endTimestamp),               // end_at
    tx.pure([Buffer.from("US"), Buffer.from("EU")]), // user_zones (GeoIP)
    tx.pure([Buffer.from("NYC"), Buffer.from("LON")]), // content_zones
    tx.pure(0),                          // planet: 0=Earth (or null for none)
    tx.pure(86400000),                   // lock_duration_ms: 24 hours
    tx.object(CLOCK_ID),                 // clock
  ],
});
```

**Targeting Example:**
```typescript
// Digital twin campaign on Moon
tx.moveCall({
  target: `${PACKAGE_ID}::ad_campaigns::create_campaign_entry`,
  arguments: [
    // ... other params ...
    tx.pure([Buffer.from("MOON")]),      // user_zones (users on Moon)
    tx.pure([Buffer.from("LUNAR_BASE")]), // content_zones
    tx.pure(1),                           // planet: 1=Moon
    // ...
  ],
});
```

### Pausing a Campaign

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::ad_campaigns::pause_campaign`,
  arguments: [
    tx.object(campaignId),
  ],
});
```

### Recording an Impression

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::ad_campaigns::deduct_impression_cost`,
  arguments: [
    tx.object(campaignId),
    tx.object(CLOCK_ID),
  ],
});
```

## Test Functions

Available only in test mode (`#[test_only]`):

### create_campaign_for_testing

Creates a campaign without payment for testing.

```move
public fun create_campaign_for_testing(
    advertiser: address,
    title: vector<u8>,
    bid: u64,
    budget: u64,
    start_at: u64,
    end_at: u64,
    ctx: &mut TxContext
): AdCampaign
```

### destroy_for_testing

Destroys a campaign object in tests.

```move
public fun destroy_for_testing(campaign: AdCampaign)
```
