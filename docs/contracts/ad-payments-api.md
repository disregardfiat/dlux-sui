# Ad Payments Contract API

**Module:** `dlux::ad_payments`  
**Location:** `contracts/metadata_pm/sources/ad_payments.move`

## Overview

The Ad Payments contract handles all financial aspects of the ad network including campaign escrow, revenue pooling, and distribution. It ensures funds are securely held and distributed according to the DLUX revenue model.

## Structs

### CampaignEscrow

Holds funds for an ad campaign.

```move
public struct CampaignEscrow has key {
    id: UID,
    campaign_id: ID,           // Associated campaign
    advertiser: address,       // Escrow owner
    balance: Balance<SUI>,     // Current balance
    total_deposited: u64,      // Total ever deposited
    total_withdrawn: u64,      // Total withdrawn for impressions
    locked_until: u64,         // Timestamp when refund becomes eligible
    is_finalized: bool,        // No more operations allowed
}
```

### RevenuePool

Collects and distributes impression revenue.

```move
public struct RevenuePool has key {
    id: UID,
    balance: Balance<SUI>,     // Current pool balance
    total_collected: u64,      // Total ever collected
    last_distribution: u64,    // Last distribution timestamp
}
```

### AdminCap

Capability required for administrative operations.

```move
public struct AdminCap has key, store {
    id: UID,
}
```

## Events

### EscrowCreated

Emitted when a new escrow is created.

```move
public struct EscrowCreated has copy, drop {
    escrow_id: ID,
    campaign_id: ID,
    advertiser: address,
    amount: u64,
    locked_until: u64,
}
```

### FundsWithdrawn

Emitted when funds are withdrawn for impressions.

```move
public struct FundsWithdrawn has copy, drop {
    escrow_id: ID,
    amount: u64,
    remaining: u64,
}
```

### EscrowRefunded

Emitted when escrow is refunded to advertiser.

```move
public struct EscrowRefunded has copy, drop {
    escrow_id: ID,
    advertiser: address,
    amount: u64,
}
```

### TransferredToPool

Emitted when funds move from escrow to revenue pool.

```move
public struct TransferredToPool has copy, drop {
    escrow_id: ID,
    pool_id: ID,
    amount: u64,
}
```

### RevenueDistributed

Emitted when revenue is distributed from pool.

```move
public struct RevenueDistributed has copy, drop {
    pool_id: ID,
    creator_share: u64,
    pm_share: u64,
    foundation_share: u64,
}
```

## Initialization

The module creates an `AdminCap` and shared `RevenuePool` on deployment:

```move
fun init(ctx: &mut TxContext)
```

**Effects:**
- Creates `AdminCap` and transfers to deployer
- Creates shared `RevenuePool`

## Functions

### create_escrow

Creates an escrow for a campaign.

```move
public fun create_escrow(
    campaign_id: ID,
    payment: Coin<SUI>,
    lock_duration_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext
)
```

**Parameters:**
- `campaign_id`: Associated campaign ID
- `payment`: SUI coin to deposit
- `lock_duration_ms`: Duration before refund is allowed (milliseconds)
- `clock`: Sui Clock object
- `ctx`: Transaction context

**Effects:**
- Creates shared `CampaignEscrow`
- Converts payment to balance
- Emits `EscrowCreated` event

**Errors:**
- `E_ZERO_AMOUNT` (5): Payment is zero

### add_funds

Adds more funds to an existing escrow.

```move
public fun add_funds(
    escrow: &mut CampaignEscrow,
    payment: Coin<SUI>,
    ctx: &TxContext
)
```

**Effects:**
- Increases escrow balance
- Updates total_deposited

**Errors:**
- `E_NOT_CAMPAIGN_OWNER` (1): Caller is not advertiser
- `E_ALREADY_FINALIZED` (6): Escrow is finalized

### withdraw_for_impression

Withdraws funds for an impression payment and adds to revenue pool.

```move
public fun withdraw_for_impression(
    escrow: &mut CampaignEscrow,
    amount: u64,
    pool: &mut RevenuePool,
    _admin: &AdminCap,
): bool
```

**Returns:** `true` if withdrawal successful, `false` otherwise.

**Effects (on success):**
- Deducts amount from escrow balance
- Adds amount to revenue pool
- Emits `FundsWithdrawn` and `TransferredToPool` events

**Returns false when:**
- Escrow is finalized
- Insufficient balance

### refund_escrow

Refunds remaining balance to advertiser after lock period.

```move
public fun refund_escrow(
    escrow: &mut CampaignEscrow,
    clock: &Clock,
    ctx: &mut TxContext
)
```

**Effects:**
- Transfers remaining balance to advertiser
- Sets escrow as finalized
- Emits `EscrowRefunded` event

**Errors:**
- `E_NOT_CAMPAIGN_OWNER` (1): Caller is not advertiser
- `E_ESCROW_LOCKED` (2): Lock period not elapsed
- `E_ALREADY_FINALIZED` (6): Already finalized

### finalize_escrow

Finalizes escrow and refunds any remaining balance (admin operation).

```move
public fun finalize_escrow(
    escrow: &mut CampaignEscrow,
    _admin: &AdminCap,
    ctx: &mut TxContext
)
```

**Effects:**
- Transfers any remaining balance to advertiser
- Sets escrow as finalized

**Errors:**
- `E_ALREADY_FINALIZED` (6): Already finalized

### distribute_revenue

Distributes accumulated revenue from pool.

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
)
```

**Parameters:**
- `pool`: Revenue pool
- `creator`: Content creator address (receives 50%)
- `foundation`: Foundation address (receives 30%)
- `pm_pool`: PM pool address (receives 20%)
- `amount`: Total amount to distribute
- `clock`: Sui Clock object
- `_admin`: Admin capability
- `ctx`: Transaction context

**Effects:**
- Splits amount according to revenue model:
  - Creator: 50%
  - Foundation: 30%
  - PM Pool: 20%
- Transfers coins to recipients
- Updates last_distribution timestamp
- Emits `RevenueDistributed` event

**Errors:**
- `E_INSUFFICIENT_FUNDS` (3): Pool balance less than amount

## View Functions

### get_balance

```move
public fun get_balance(escrow: &CampaignEscrow): u64
```

Returns current escrow balance.

### get_advertiser

```move
public fun get_advertiser(escrow: &CampaignEscrow): address
```

Returns escrow owner address.

### get_campaign_id

```move
public fun get_campaign_id(escrow: &CampaignEscrow): ID
```

Returns associated campaign ID.

### is_finalized

```move
public fun is_finalized(escrow: &CampaignEscrow): bool
```

Returns whether escrow is finalized.

### is_unlocked

```move
public fun is_unlocked(escrow: &CampaignEscrow, clock: &Clock): bool
```

Returns whether lock period has elapsed.

### get_pool_balance

```move
public fun get_pool_balance(pool: &RevenuePool): u64
```

Returns current revenue pool balance.

### get_total_collected

```move
public fun get_total_collected(pool: &RevenuePool): u64
```

Returns total ever collected by pool.

## Revenue Distribution Model

The DLUX ad network distributes revenue as follows:

| Recipient | Share | Purpose |
|-----------|-------|---------|
| Content Creator | 50% | Reward for hosting ads |
| Foundation | 30% | Platform infrastructure |
| PM Pool | 20% | Prediction market incentives |

This matches the model defined in `docs/ad-network.md`.

## Usage Examples

### Creating an Escrow

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::ad_payments::create_escrow`,
  arguments: [
    tx.pure(campaignId),              // campaign_id
    tx.object(paymentCoinId),         // payment
    tx.pure(86400000 * 30),           // 30 day lock
    tx.object(CLOCK_ID),              // clock
  ],
});
```

### Distributing Revenue

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::ad_payments::distribute_revenue`,
  arguments: [
    tx.object(poolId),                // pool
    tx.pure(creatorAddress),          // creator
    tx.pure(foundationAddress),       // foundation
    tx.pure(pmPoolAddress),           // pm_pool
    tx.pure(1000000000),              // 1 SUI
    tx.object(CLOCK_ID),              // clock
    tx.object(adminCapId),            // admin
  ],
});
```

## Test Functions

Available only in test mode (`#[test_only]`):

### init_for_testing

Initializes module in tests.

```move
public fun init_for_testing(ctx: &mut TxContext)
```

### create_escrow_for_testing

Creates an escrow without payment for testing.

```move
public fun create_escrow_for_testing(
    campaign_id: ID,
    advertiser: address,
    amount: u64,
    locked_until: u64,
    ctx: &mut TxContext
): CampaignEscrow
```

### destroy_escrow_for_testing

Destroys an escrow object in tests.

```move
public fun destroy_escrow_for_testing(escrow: CampaignEscrow)
```

## Security Considerations

1. **Lock Periods**: Escrow funds are locked for a configurable duration to prevent immediate withdrawal after campaign creation.

2. **Admin Capability**: Revenue distribution requires AdminCap to prevent unauthorized distributions.

3. **Finalization**: Once finalized, no further operations are allowed on an escrow.

4. **Balance Checks**: All withdrawals verify sufficient balance before executing.
