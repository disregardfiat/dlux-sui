# Move Contracts Audit Report

**Date:** February 5, 2026  
**Package:** `dlux_metadata_pm`  
**Location:** `contracts/metadata_pm/`

## Executive Summary

This audit reviews four Move smart contracts that power the DLUX Ad Network:
1. **metadata_pm.move** - ZK proof verification, Merkle trees, revenue distribution
2. **ad_campaigns.move** - Campaign lifecycle management
3. **ad_payments.move** - Escrow and revenue pooling
4. **ad_tracking.move** - Privacy-preserving click/conversion tracking

**Overall Assessment:** The contracts are well-structured and cover core functionality, but several critical features are marked as TODOs (ZK verification, Merkle proofs, token transfers) that need implementation before production deployment.

---

## 1. metadata_pm.move

### What It Does

Core contract for:
- **ZK proof verification** for ad views (privacy-preserving)
- **Merkle tree batch verification** for aggregating impressions
- **Ad revenue pool** creation and threshold-based distribution
- **Location metadata** structures (latitude, longitude, elevation, planet)
- **Digital twin origin markers** (GLTF index + 6DOF pose)

### Correctness Analysis

#### ✅ **Correct Implementations:**

1. **Data Structures**: Well-defined structs for `LocationMetadata`, `DigitalTwinOrigin`, `MerkleRoot`, `AdRevenuePool`
2. **Revenue Distribution Logic**: Correctly calculates 50% creator, 20% PM, 30% foundation shares
3. **Threshold Checking**: Properly validates `leaf_count >= threshold` before distribution
4. **Double-Spend Prevention**: `distributed` flag prevents multiple distributions
5. **Event Emission**: Proper events for `RevenueDistributed` and `ZKProofVerified`

#### ⚠️ **Critical Issues:**

1. **ZK Proof Verification is Placeholder** (Lines 63-86)
   ```move
   // TODO: Implement actual ZK proof verification using on-chain verifier
   // For now, this is a placeholder that returns true
   ```
   - **Risk**: HIGH - Accepts any non-empty proof as valid
   - **Impact**: No actual cryptographic verification of ad views
   - **Fix Required**: Integrate Groth16 verifier or equivalent ZK verifier

2. **Merkle Inclusion Proof is Placeholder** (Lines 89-109)
   ```move
   // TODO: Implement Merkle tree verification
   ```
   - **Risk**: HIGH - Only checks path/indices are non-empty
   - **Impact**: Cannot verify impressions are actually in Merkle tree
   - **Fix Required**: Implement proper Merkle proof verification algorithm

3. **Token Transfers Not Implemented** (Lines 168-171)
   ```move
   // TODO: Actual token transfers would happen here
   ```
   - **Risk**: MEDIUM - Events emitted but no SUI transferred
   - **Impact**: Revenue distribution events fire but funds don't move
   - **Fix Required**: Add SUI coin transfers to creator/foundation/PM addresses

4. **No Input Validation**:
   - `create_location_metadata()` doesn't validate coordinate ranges
   - `create_digital_twin_origin()` doesn't validate quaternion normalization
   - `create_merkle_root()` doesn't validate `threshold <= leaf_count`

### Coverage Analysis

#### ✅ **Covered:**
- Revenue pool creation
- Threshold-based distribution logic
- Event emission for tracking
- Basic data structure creation

#### ❌ **Missing:**
- Actual ZK proof verification (critical)
- Merkle tree verification (critical)
- SUI token transfers (critical)
- Input validation for metadata
- Content creator address resolution
- Foundation/PM pool address management
- Batch verification optimization

### Suggested Metadata

```move
/// Suggested: Add input validation
public fun create_location_metadata(
    latitude: u64,   // Should validate: -90e6 to 90e6
    longitude: u64,   // Should validate: -180e6 to 180e6
    elevation: u64,  // Should validate: reasonable range
    planet: u8       // Should validate: 0-2 only
): LocationMetadata {
    // Add assertions for valid ranges
}

/// Suggested: Add quaternion normalization check
public fun create_digital_twin_origin(
    gltf_index: vector<u8>,
    position_x: u64,
    position_y: u64,
    position_z: u64,
    rotation_x: u64,  // Quaternion components
    rotation_y: u64,
    rotation_z: u64,
    rotation_w: u64   // Should validate: x²+y²+z²+w² ≈ 1
): DigitalTwinOrigin {
    // Add quaternion validation
}

/// Suggested: Add threshold validation
public fun create_merkle_root(
    content_id: vector<u8>,
    root_hash: vector<u8>,
    leaf_count: u64,
    threshold: u64    // Should assert: threshold <= leaf_count
): MerkleRoot {
    assert!(threshold <= leaf_count, E_INVALID_THRESHOLD);
    // ...
}

/// Suggested: Add content creator resolution
public fun get_content_creator(content_id: vector<u8>): address {
    // Resolve creator address from content_id
    // This may require integration with content registry
}

/// Suggested: Complete token transfer implementation
public fun distribute_ad_revenue(
    pool: &mut AdRevenuePool,
    merkle_root: &MerkleRoot,
    verified_proofs: vector<vector<u8>>,
    creator: address,        // ADD: Creator address parameter
    foundation: address,     // ADD: Foundation address parameter
    pm_pool: address,        // ADD: PM pool address parameter
    ctx: &mut TxContext
) {
    // ... existing validation ...
    
    // ADD: Actual SUI transfers
    let creator_coin = coin::take(&mut pool.balance, creator_share, ctx);
    transfer::public_transfer(creator_coin, creator);
    
    let foundation_coin = coin::take(&mut pool.balance, foundation_share, ctx);
    transfer::public_transfer(foundation_coin, foundation);
    
    let pm_coin = coin::take(&mut pool.balance, pm_share, ctx);
    transfer::public_transfer(pm_coin, pm_pool);
}
```

---

## 2. ad_campaigns.move

### What It Does

Manages complete ad campaign lifecycle:
- **Campaign creation** with SUI payment and escrow
- **Campaign updates** (title, description, target_url)
- **Status management** (active, paused, cancelled, expired, depleted)
- **Impression cost deduction** with budget tracking
- **GeoIP targeting** via `user_zones`
- **Content zone targeting** via `content_zones`
- **Digital twin support** via `planet` field
- **Escrow integration** with `ad_payments` module

### Correctness Analysis

#### ✅ **Correct Implementations:**

1. **Access Control**: Proper advertiser-only checks (`E_NOT_ADVERTISER`)
2. **Status Transitions**: Correct state machine (active → paused → active, etc.)
3. **Budget Tracking**: Accurate deduction and depletion detection
4. **Date Validation**: Checks `end_at > start_at` and `end_at > now`
5. **Escrow Integration**: Properly creates escrow and links via `escrow_id`
6. **Event Emission**: All state changes emit appropriate events
7. **Automatic Status Updates**: Expires campaigns past `end_at`, depletes when budget < bid

#### ⚠️ **Issues Found:**

1. **Missing Validation in `create_campaign`**:
   - No validation that `placements` vector is non-empty
   - No validation that `title`/`description`/`target_url` are non-empty
   - No maximum length checks on string fields
   - No validation that `bid` is reasonable (could be 1 MIST, causing spam)

2. **Race Condition Risk** (Lines 303-343):
   - `deduct_impression_cost()` updates campaign state
   - `withdraw_for_impression()` in `ad_payments` happens separately
   - If withdrawal fails, campaign state is already updated
   - **Fix**: Should be atomic or use two-phase commit

3. **No Refund Integration**:
   - `cancel_campaign()` emits refund event but doesn't call `refund_escrow()`
   - Relies on external service to handle refund
   - **Risk**: MEDIUM - Campaign cancelled but funds may not be refunded

4. **Missing Targeting Validation**:
   - `user_zones` and `content_zones` accept any vector values
   - No validation of zone format (should be ISO country codes?)
   - No validation that `planet` option is 0-2 if `Some`

5. **No Campaign Pause During Active Period Check**:
   - `pause_campaign()` doesn't verify campaign is within date range
   - Can pause expired campaigns (harmless but inconsistent)

### Coverage Analysis

#### ✅ **Covered:**
- Campaign CRUD operations
- Status management
- Budget tracking
- Escrow creation
- Impression deduction
- Targeting fields (zones, planet)
- Event emission

#### ⚠️ **Partially Covered:**
- Refunds (event only, no actual transfer)
- Campaign cancellation (state update only)

#### ❌ **Missing:**
- Input validation (strings, placements, bid amounts)
- Atomic impression + withdrawal
- Campaign analytics queries
- Bulk operations
- Campaign templates/cloning
- Budget alerts/thresholds

### Suggested Metadata

```move
/// Suggested: Add comprehensive validation
public fun create_campaign(
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
) {
    // ADD: Input validation
    assert!(std::vector::length(&title) > 0, E_EMPTY_TITLE);
    assert!(std::vector::length(&title) <= MAX_TITLE_LENGTH, E_TITLE_TOO_LONG);
    assert!(std::vector::length(&description) <= MAX_DESCRIPTION_LENGTH, E_DESCRIPTION_TOO_LONG);
    assert!(std::vector::length(&target_url) > 0, E_EMPTY_URL);
    assert!(std::vector::length(&placements) > 0, E_NO_PLACEMENTS);
    assert!(bid >= MIN_BID_AMOUNT, E_BID_TOO_LOW);  // Prevent spam
    assert!(bid <= MAX_BID_AMOUNT, E_BID_TOO_HIGH); // Prevent overflow
    
    // ADD: Validate planet if Some
    if (option::is_some(&planet)) {
        let p = *option::borrow(&planet);
        assert!(p <= 2, E_INVALID_PLANET);
    };
    
    // ADD: Validate zone formats (if standardized)
    // validate_zones(&user_zones);
    // validate_zones(&content_zones);
    
    // ... rest of function ...
}

/// Suggested: Add atomic impression + withdrawal
public entry fun record_impression_atomic(
    campaign: &mut AdCampaign,
    escrow: &mut CampaignEscrow,
    pool: &mut RevenuePool,
    admin: &AdminCap,
    clock: &Clock,
    ctx: &mut TxContext
): bool {
    // Check campaign allows impression
    if (!deduct_impression_cost(campaign, clock)) {
        return false
    };
    
    // Withdraw from escrow (if this fails, we need to rollback campaign state)
    if (!ad_payments::withdraw_for_impression(escrow, campaign.bid, pool, admin)) {
        // ROLLBACK: Restore campaign state
        campaign.remaining_budget = campaign.remaining_budget + campaign.bid;
        campaign.impression_count = campaign.impression_count - 1;
        if (campaign.status == STATUS_BUDGET_DEPLETED) {
            campaign.status = STATUS_ACTIVE;
        };
        return false
    };
    
    true
}

/// Suggested: Integrate refund in cancel
public fun cancel_campaign(
    campaign: &mut AdCampaign,
    escrow: &mut CampaignEscrow,
    clock: &Clock,
    ctx: &mut TxContext
) {
    assert!(ctx.sender() == campaign.advertiser, E_NOT_ADVERTISER);
    assert!(campaign.status != STATUS_CANCELLED, E_CAMPAIGN_CANCELLED);
    
    let old_status = campaign.status;
    let refund_amount = campaign.remaining_budget;
    
    campaign.status = STATUS_CANCELLED;
    campaign.remaining_budget = 0;
    
    // ADD: Actually refund escrow if unlocked
    if (ad_payments::is_unlocked(escrow, clock)) {
        ad_payments::refund_escrow(escrow, clock, ctx);
    };
    
    event::emit(CampaignStatusChanged { /* ... */ });
    event::emit(CampaignCancelled { /* ... */ });
}

/// Suggested: Add constants
const MIN_BID_AMOUNT: u64 = 1000;  // 0.000001 SUI minimum
const MAX_BID_AMOUNT: u64 = 1000000000000;  // 1000 SUI maximum
const MAX_TITLE_LENGTH: u64 = 200;
const MAX_DESCRIPTION_LENGTH: u64 = 2000;
const MAX_URL_LENGTH: u64 = 2048;
const E_EMPTY_TITLE: u64 = 11;
const E_TITLE_TOO_LONG: u64 = 12;
const E_DESCRIPTION_TOO_LONG: u64 = 13;
const E_EMPTY_URL: u64 = 14;
const E_NO_PLACEMENTS: u64 = 15;
const E_BID_TOO_LOW: u64 = 16;
const E_BID_TOO_HIGH: u64 = 17;
const E_INVALID_PLANET: u64 = 18;
```

---

## 3. ad_payments.move

### What It Does

Handles all financial operations:
- **Campaign escrow** creation and management
- **Revenue pooling** from impressions
- **Revenue distribution** (50% creator, 30% foundation, 20% PM)
- **Refund handling** after lock periods
- **Fund withdrawal** for impressions

### Correctness Analysis

#### ✅ **Correct Implementations:**

1. **Escrow Lock Mechanism**: Proper lock period enforcement
2. **Access Control**: Advertiser-only refunds, admin-only distributions
3. **Balance Management**: Correct use of `Balance<SUI>` and `Coin<SUI>`
4. **Finalization**: Prevents operations after finalization
5. **Event Emission**: All financial operations emit events
6. **Revenue Split**: Correctly calculates 50/30/20 distribution
7. **Initialization**: Properly creates `AdminCap` and shared `RevenuePool`

#### ⚠️ **Issues Found:**

1. **Single Revenue Pool**:
   - Only one shared `RevenuePool` for all campaigns
   - **Risk**: MEDIUM - All revenue mixed together, harder to track per-content
   - **Consideration**: May be intentional for simplicity, but limits per-content tracking

2. **No Distribution Threshold**:
   - `distribute_revenue()` can be called for any amount
   - **Risk**: LOW - Gas costs may make small distributions uneconomical
   - **Suggestion**: Add minimum distribution amount

3. **AdminCap Management**:
   - Created once in `init()` and transferred to deployer
   - **Risk**: MEDIUM - If deployer loses AdminCap, no way to distribute revenue
   - **Suggestion**: Consider multi-sig or governance mechanism

4. **Revenue Split Calculation** (Lines 258-260):
   ```move
   let creator_share = amount * 50 / 100;
   let foundation_share = amount * 30 / 100;
   let pm_share = amount - creator_share - foundation_share; // Remainder to PM
   ```
   - **Issue**: Uses remainder instead of explicit 20% calculation
   - **Risk**: LOW - Works correctly but less explicit
   - **Note**: This handles rounding correctly (if 50% + 30% = 80%, remainder = 20%)

5. **No Partial Refund Support**:
   - `refund_escrow()` refunds all remaining balance
   - **Consideration**: May want partial refunds for cancelled campaigns

6. **Missing Error for Zero Distribution**:
   - `distribute_revenue()` doesn't check `amount > 0`
   - **Risk**: LOW - Would just emit events with zero amounts

### Coverage Analysis

#### ✅ **Covered:**
- Escrow creation and management
- Fund withdrawal for impressions
- Revenue pooling
- Revenue distribution
- Refund handling
- Lock period enforcement

#### ⚠️ **Partially Covered:**
- Admin capability management (single deployer)

#### ❌ **Missing:**
- Per-content revenue tracking
- Distribution thresholds/minimums
- Multi-sig or governance for AdminCap
- Partial refunds
- Revenue pool analytics
- Historical distribution tracking

### Suggested Metadata

```move
/// Suggested: Add minimum distribution threshold
const MIN_DISTRIBUTION_AMOUNT: u64 = 1000000;  // 0.001 SUI minimum

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
    // ADD: Validate amount
    assert!(amount > 0, E_ZERO_AMOUNT);
    assert!(amount >= MIN_DISTRIBUTION_AMOUNT, E_DISTRIBUTION_TOO_SMALL);
    assert!(balance::value(&pool.balance) >= amount, E_INSUFFICIENT_FUNDS);
    
    // ... rest of function ...
}

/// Suggested: Add per-content revenue tracking
public struct ContentRevenuePool has key {
    id: UID,
    content_id: vector<u8>,
    balance: Balance<SUI>,
    total_collected: u64,
    last_distribution: u64,
}

/// Suggested: Add explicit PM share calculation
public fun distribute_revenue(
    // ... parameters ...
) {
    // Use explicit 20% instead of remainder
    let creator_share = amount * 50 / 100;
    let foundation_share = amount * 30 / 100;
    let pm_share = amount * 20 / 100;  // Explicit instead of remainder
    
    // Verify sum equals amount (handles rounding)
    assert!(creator_share + foundation_share + pm_share <= amount, E_ROUNDING_ERROR);
    
    // ... rest of function ...
}

/// Suggested: Add partial refund support
public fun partial_refund_escrow(
    escrow: &mut CampaignEscrow,
    refund_amount: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    assert!(ctx.sender() == escrow.advertiser, E_NOT_CAMPAIGN_OWNER);
    assert!(now >= escrow.locked_until, E_ESCROW_LOCKED);
    assert!(!escrow.is_finalized, E_ALREADY_FINALIZED);
    
    let available = balance::value(&escrow.balance);
    assert!(refund_amount <= available, E_INSUFFICIENT_FUNDS);
    
    let refund_balance = balance::split(&mut escrow.balance, refund_amount);
    let refund_coin = coin::from_balance(refund_balance, ctx);
    transfer::public_transfer(refund_coin, escrow.advertiser);
    
    event::emit(EscrowRefunded { /* ... */ });
}

/// Suggested: Add error codes
const E_DISTRIBUTION_TOO_SMALL: u64 = 7;
const E_ROUNDING_ERROR: u64 = 8;
```

---

## 4. ad_tracking.move

### What It Does

Privacy-preserving click and conversion tracking:
- **Click token generation** with SHA3-256 hashing
- **Token verification** with expiration checks
- **Conversion recording** linked to click tokens
- **Conversion verification** by authorized verifiers
- **Anonymous tracking** (no user identity stored)

### Correctness Analysis

#### ✅ **Correct Implementations:**

1. **Token Hashing**: Proper SHA3-256 (Keccak256) of ad_id || content_id || nonce || timestamp
2. **Expiration Handling**: Correct TTL (24 hours) and expiration checks
3. **Double-Use Prevention**: `is_used` flag prevents token reuse
4. **Registry Tracking**: Proper use of `Table` for token/conversion storage
5. **Access Control**: `VerifierCap` required for conversion verification
6. **Event Emission**: All operations emit tracking events
7. **Initialization**: Properly creates `VerifierCap` and shared `ClickTokenRegistry`

#### ⚠️ **Issues Found:**

1. **Token Hash Collision Risk**:
   - Uses `ad_id || content_id || nonce || timestamp` for hashing
   - **Risk**: LOW - Collision probability is negligible with proper nonce
   - **Consideration**: Nonce should be cryptographically random

2. **No Token Revocation**:
   - Once created, tokens cannot be revoked
   - **Risk**: LOW - Tokens expire naturally
   - **Consideration**: May want admin revocation for fraud cases

3. **Conversion Verification Logic** (Lines 240-255):
   - `verify_conversion()` only sets `verified = true`
   - No actual verification logic (e.g., checking conversion proof)
   - **Risk**: MEDIUM - Any verifier can mark any conversion as verified
   - **Suggestion**: Add conversion proof verification

4. **No Conversion Expiration**:
   - Conversions don't expire
   - **Risk**: LOW - Conversions are typically immediate
   - **Consideration**: May want time window for valid conversions

5. **Registry Stats Not Protected**:
   - `total_clicks` and `total_conversions` can be manipulated by creating tokens
   - **Risk**: LOW - Stats are informational only
   - **Note**: This is expected behavior (tokens = clicks)

6. **Missing Token Cleanup**:
   - Expired tokens remain in registry forever
   - **Risk**: LOW - Storage cost is minimal
   - **Consideration**: May want periodic cleanup for expired tokens

### Coverage Analysis

#### ✅ **Covered:**
- Click token creation
- Token verification
- Conversion recording
- Conversion verification
- Anonymous tracking
- Registry management

#### ⚠️ **Partially Covered:**
- Conversion verification (marking only, no proof check)

#### ❌ **Missing:**
- Token revocation
- Conversion proof verification
- Conversion expiration
- Token cleanup/expiration
- Fraud detection mechanisms
- Token analytics/queries

### Suggested Metadata

```move
/// Suggested: Add conversion proof verification
public fun verify_conversion(
    registry: &mut ClickTokenRegistry,
    click_token_hash: vector<u8>,
    conversion_proof: vector<u8>,  // ADD: Conversion proof
    _verifier: &VerifierCap,
) {
    assert!(table::contains(&registry.conversions, click_token_hash), E_INVALID_TOKEN);
    
    // ADD: Verify conversion proof (e.g., ZK proof or signature)
    // verify_conversion_proof(conversion_proof, click_token_hash);
    
    let conversion = table::borrow_mut(&mut registry.conversions, click_token_hash);
    conversion.verified = true;
    
    event::emit(ConversionVerified { /* ... */ });
}

/// Suggested: Add token revocation
public fun revoke_token(
    registry: &mut ClickTokenRegistry,
    token_hash: vector<u8>,
    _admin: &AdminCap,
) {
    // Remove token from registry
    if (table::contains(&registry.tokens, token_hash)) {
        table::remove(&mut registry.tokens, token_hash);
    };
    
    event::emit(TokenRevoked { token_hash });
}

/// Suggested: Add conversion expiration
const CONVERSION_WINDOW_MS: u64 = 86400000;  // 24 hours

public fun record_conversion(
    token: &mut ClickToken,
    registry: &mut ClickTokenRegistry,
    conversion_nonce: vector<u8>,
    clock: &Clock,
    _verifier: &VerifierCap,
) {
    let now = clock.timestamp_ms();
    
    // ADD: Check conversion window
    assert!(now <= token.expires_at + CONVERSION_WINDOW_MS, E_CONVERSION_EXPIRED);
    
    // ... rest of function ...
}

/// Suggested: Add cleanup for expired tokens
public fun cleanup_expired_tokens(
    registry: &mut ClickTokenRegistry,
    expired_hashes: vector<vector<u8>>,
    clock: &Clock,
    _admin: &AdminCap,
) {
    let now = clock.timestamp_ms();
    let count = std::vector::length(&expired_hashes);
    let mut i = 0;
    
    while (i < count) {
        let hash = *std::vector::borrow(&expired_hashes, i);
        if (table::contains(&registry.tokens, hash)) {
            table::remove(&mut registry.tokens, hash);
        };
        i = i + 1;
    };
}

/// Suggested: Add error codes
const E_CONVERSION_EXPIRED: u64 = 6;
const E_INVALID_CONVERSION_PROOF: u64 = 7;
```

---

## Cross-Contract Integration Analysis

### ✅ **Well Integrated:**

1. **Campaign ↔ Escrow**: `ad_campaigns` creates escrow via `ad_payments::create_escrow()` and stores `escrow_id`
2. **Impression Flow**: `ad_campaigns::record_impression_with_escrow()` calls `ad_payments::withdraw_for_impression()`
3. **Event Consistency**: All contracts emit events that can be indexed off-chain

### ⚠️ **Integration Gaps:**

1. **Revenue Distribution**: `metadata_pm::distribute_ad_revenue()` doesn't integrate with `ad_payments::RevenuePool`
   - Two separate revenue distribution mechanisms
   - **Suggestion**: Unify or clarify relationship

2. **Tracking ↔ Campaigns**: `ad_tracking` uses `ad_id: ID` but doesn't verify campaign exists
   - **Risk**: LOW - Tokens can reference non-existent campaigns
   - **Suggestion**: Add campaign existence check

3. **Metadata ↔ Payments**: `metadata_pm` creates `AdRevenuePool` but `ad_payments` has separate `RevenuePool`
   - **Confusion**: Two pool types with similar names
   - **Suggestion**: Clarify or unify

---

## Caller-Controlled Recipient Addresses (Fixed 2026-02-09)

**Vulnerability:** Functions that transfer protocol funds were accepting recipient addresses as caller-provided parameters, allowing attackers to redirect fees to arbitrary addresses.

### dapp_posting.move – FIXED
- **post_dapp** previously took `pm_pool_address` and `foundation_address` from the caller. Anyone could call and route 100% of the posting fee to themselves.
- **Fix:** Introduced `PostingTreasuryConfig` shared object storing canonical addresses. Foundation address hardcoded as const; PM address admin-updatable via `set_fee_recipients`.
- **Follow-up (audit remediation):** (1) Foundation is now immutable: `set_fee_recipients` takes only `pm_pool_address` (no foundation param). (2) Fee flow uses `PostingFeePool`: posting fee is deposited to the pool, `total_collected` is updated, then 50% is transferred to PM pool and 50% to foundation from the pool. (3) Input length caps added (`MAX_FIELD_LEN` 2048, `MAX_VECTOR_LEN` 64) for gas/DoS protection. (4) Unused error codes and dead code removed; dApp ID generation simplified (keccak256 used directly). (5) New test `test_post_dapp_name_too_long` for `E_INPUT_TOO_LONG`; `test_post_dapp_with_fee` asserts `get_total_collected`.

### ad_payments.move – MITIGATED
- **distribute_revenue** and **walrus_drawdown** take `creator`, `foundation`, `pm_pool` (and `walrus_provider`) from the caller.
- **Mitigation:** Both require `AdminCap`; only our backend calls them. Lower risk than dapp_posting, but a compromised AdminCap holder could redirect funds.
- **Recommendation:** Add `RevenueTreasuryConfig` with canonical foundation/PM addresses for defense-in-depth.

### metadata_pm.move – MITIGATED
- **distribute_ad_revenue** takes `creator`, `foundation`, `pm_pool` from the caller.
- **Mitigation:** Caller must pass `&mut AdRevenuePool`; only the pool owner can call. Pool owner funded the pool.
- **Recommendation:** Add `TreasuryConfig` with canonical foundation/PM for consistency.

---

## Security Assessment

### ✅ **Strong Security:**

1. **Access Control**: Proper advertiser/admin/verifier checks
2. **Privacy**: Anonymous tokens, no user identity stored
3. **Finalization**: Prevents operations after finalization
4. **Lock Periods**: Prevents immediate refunds

### ⚠️ **Security Concerns:**

1. **ZK Verification Bypass**: Placeholder accepts any proof
2. **Merkle Proof Bypass**: Placeholder accepts any proof
3. **AdminCap Single Point of Failure**: Lost cap = no distributions
4. **No Rate Limiting**: Could create many campaigns/tokens rapidly
5. **No Fraud Detection**: No mechanisms to detect fake impressions/clicks

---

## Test Coverage Analysis

### Current Test Coverage:

- **metadata_pm_tests.move**: 13 tests
- **ad_campaigns_tests.move**: 9 tests  
- **ad_payments_tests.move**: 3 tests
- **ad_tracking_tests.move**: 3 tests
- **Total: 28 tests**

### ✅ **Well Tested:**

- Basic creation operations
- Status transitions
- Budget deduction
- Token expiration
- Registry initialization

### ❌ **Missing Tests:**

- Error cases (invalid inputs, unauthorized access)
- Edge cases (zero amounts, maximum values)
- Integration tests (cross-contract flows)
- ZK proof verification (when implemented)
- Merkle proof verification (when implemented)
- Token transfer tests (when implemented)
- Refund scenarios
- Concurrent operations
- Gas optimization tests

---

## Recommendations Summary

### 🔴 **Critical (Must Fix Before Production):**

1. **Implement ZK Proof Verification** (`metadata_pm.move`)
   - Integrate Groth16 or equivalent verifier
   - Replace placeholder with actual verification

2. **Implement Merkle Proof Verification** (`metadata_pm.move`)
   - Implement proper Merkle tree verification algorithm
   - Verify leaf inclusion in tree

3. **Implement Token Transfers** (`metadata_pm.move`)
   - Add SUI coin transfers to `distribute_ad_revenue()`
   - Transfer to creator, foundation, PM pool addresses

### 🟡 **High Priority (Should Fix Soon):**

4. **Add Input Validation** (`ad_campaigns.move`)
   - Validate string lengths, bid amounts, placements
   - Add minimum/maximum constraints

5. **Fix Atomic Impression + Withdrawal** (`ad_campaigns.move`)
   - Make impression deduction + escrow withdrawal atomic
   - Add rollback mechanism if withdrawal fails

6. **Integrate Refund in Cancel** (`ad_campaigns.move`)
   - Call `refund_escrow()` when cancelling campaigns
   - Ensure funds are actually returned

7. **Add Conversion Proof Verification** (`ad_tracking.move`)
   - Verify conversion proofs before marking verified
   - Prevent unauthorized verification

### 🟢 **Medium Priority (Nice to Have):**

8. **Add Distribution Thresholds** (`ad_payments.move`)
   - Minimum distribution amount to prevent gas waste

9. **Improve AdminCap Management** (`ad_payments.move`)
   - Consider multi-sig or governance mechanism

10. **Add Token Revocation** (`ad_tracking.move`)
    - Allow admin to revoke tokens for fraud cases

11. **Unify Revenue Pools** (Cross-contract)
    - Clarify relationship between `AdRevenuePool` and `RevenuePool`

12. **Add Comprehensive Error Handling**
    - More specific error codes
    - Better error messages

### 📋 **Documentation:**

13. **Add Function Documentation**
    - Document all public functions with `///` comments
    - Include parameter descriptions and return values

14. **Add Usage Examples**
    - Example transactions for common flows
    - Integration guides

---

## All Suggested Metadata

### metadata_pm.move

```move
// Constants
const E_INVALID_THRESHOLD: u64 = 5;
const E_INVALID_COORDINATE: u64 = 6;
const E_INVALID_QUATERNION: u64 = 7;
const MAX_LATITUDE: u64 = 90000000;  // 90 degrees * 1e6
const MAX_LONGITUDE: u64 = 180000000;  // 180 degrees * 1e6

// Input validation
public fun create_location_metadata(
    latitude: u64,
    longitude: u64,
    elevation: u64,
    planet: u8
): LocationMetadata {
    assert!(latitude <= MAX_LATITUDE, E_INVALID_COORDINATE);
    assert!(longitude <= MAX_LONGITUDE, E_INVALID_COORDINATE);
    assert!(planet <= 2, E_INVALID_PLANET);
    // ... rest
}

// Quaternion validation helper
fun validate_quaternion(x: u64, y: u64, z: u64, w: u64): bool {
    // Check normalization: x² + y² + z² + w² ≈ 1 (within tolerance)
    // Implementation depends on scaling factor
}

// Content creator resolution
public fun get_content_creator(content_id: vector<u8>): Option<address> {
    // Resolve from content registry or return None
}

// Complete revenue distribution with transfers
public fun distribute_ad_revenue(
    pool: &mut AdRevenuePool,
    merkle_root: &MerkleRoot,
    verified_proofs: vector<vector<u8>>,
    creator: address,
    foundation: address,
    pm_pool: address,
    ctx: &mut TxContext
) {
    // ... validation ...
    
    // Actual transfers
    let creator_coin = coin::take(&mut pool.balance, creator_share, ctx);
    transfer::public_transfer(creator_coin, creator);
    // ... similar for foundation and pm_pool ...
}
```

### ad_campaigns.move

```move
// Constants
const MIN_BID_AMOUNT: u64 = 1000;
const MAX_BID_AMOUNT: u64 = 1000000000000;
const MAX_TITLE_LENGTH: u64 = 200;
const MAX_DESCRIPTION_LENGTH: u64 = 2000;
const MAX_URL_LENGTH: u64 = 2048;

// Error codes
const E_EMPTY_TITLE: u64 = 11;
const E_TITLE_TOO_LONG: u64 = 12;
const E_DESCRIPTION_TOO_LONG: u64 = 13;
const E_EMPTY_URL: u64 = 14;
const E_NO_PLACEMENTS: u64 = 15;
const E_BID_TOO_LOW: u64 = 16;
const E_BID_TOO_HIGH: u64 = 17;
const E_INVALID_PLANET: u64 = 18;

// Atomic impression + withdrawal
public entry fun record_impression_atomic(
    campaign: &mut AdCampaign,
    escrow: &mut CampaignEscrow,
    pool: &mut RevenuePool,
    admin: &AdminCap,
    clock: &Clock,
    ctx: &mut TxContext
): bool {
    // ... with rollback on failure ...
}

// Cancel with refund integration
public fun cancel_campaign(
    campaign: &mut AdCampaign,
    escrow: &mut CampaignEscrow,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // ... with actual refund call ...
}
```

### ad_payments.move

```move
// Constants
const MIN_DISTRIBUTION_AMOUNT: u64 = 1000000;

// Error codes
const E_DISTRIBUTION_TOO_SMALL: u64 = 7;
const E_ROUNDING_ERROR: u64 = 8;

// Per-content revenue pool
public struct ContentRevenuePool has key {
    id: UID,
    content_id: vector<u8>,
    balance: Balance<SUI>,
    total_collected: u64,
    last_distribution: u64,
}

// Partial refund
public fun partial_refund_escrow(
    escrow: &mut CampaignEscrow,
    refund_amount: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // ... implementation ...
}
```

### ad_tracking.move

```move
// Constants
const CONVERSION_WINDOW_MS: u64 = 86400000;

// Error codes
const E_CONVERSION_EXPIRED: u64 = 6;
const E_INVALID_CONVERSION_PROOF: u64 = 7;

// Conversion proof verification
public fun verify_conversion(
    registry: &mut ClickTokenRegistry,
    click_token_hash: vector<u8>,
    conversion_proof: vector<u8>,
    _verifier: &VerifierCap,
) {
    // ... with proof verification ...
}

// Token revocation
public fun revoke_token(
    registry: &mut ClickTokenRegistry,
    token_hash: vector<u8>,
    _admin: &AdminCap,
) {
    // ... implementation ...
}

// Cleanup expired tokens
public fun cleanup_expired_tokens(
    registry: &mut ClickTokenRegistry,
    expired_hashes: vector<vector<u8>>,
    clock: &Clock,
    _admin: &AdminCap,
) {
    // ... implementation ...
}
```

---

## Governance & Revenue Splits Remediation (2026-02-10)

### New Contract: `governance.move`

A new module was created to centralize all votable platform parameters:

**`GovernanceConfig`** — single shared object holding:
- `pm_duration_ms` (default 3 days): How long the prediction market runs after a dApp is posted.
- `votable_posting_fee` (default 1 SUI): Non-storage portion of the posting fee.
- PM-period splits (10/9/41/40): foundation / gateway / creator (escrow) / PM pool.
- Post-PM-success splits (10/9/81/0): foundation / gateway / creator / PM pool.
- `proposal_duration_ms` (default 7 days): Voting window for governance proposals.
- `quorum_pct` (default 51): Minimum voter turnout.

**`GovernanceProposal`** — per-proposal shared object for on-chain governance:
- `param_key` + `param_value` for simple parameters.
- `split_values` (4-element vector) for split proposals.
- `eligible_voters_root` — Merkle root of eligible voter addresses.
- `execute_proposal()` verifies Merkle proofs (reusing `merkle_verifier`), checks quorum + YES majority, and applies the change.

**`GovernanceAdminCap`** — separate admin capability for governance (held by backend).

### Off-Chain Governance Flow

```
1. Backend identifies eligible voters (top-half creators + equal PM earners)
2. Backend builds eligible-voters Merkle tree → stores root on GovernanceProposal
3. Eligible member proposes parameter change via backend
4. Backend creates GovernanceProposal on-chain (param_key, value, voters_root)
5. Voting period: voters submit signed votes to backend
6. After voting window + quorum: backend builds vote Merkle tree
7. Backend calls execute_proposal(vote_root_hash, proofs, yes_count, no_count)
8. Contract verifies Merkle proofs, checks quorum + majority, applies change
```

### Findings Addressed

| Finding | Status | Resolution |
|---------|--------|------------|
| `@0x0` placeholder addresses in `ad_payments.move` | ✅ **FIXED** | Removed `FIXED_FOUNDATION` and `FIXED_PM_POOL` constants. `distribute_revenue` and `walrus_drawdown` now take `foundation` and `pm_pool` as parameters (AdminCap-gated). |
| Hardcoded revenue splits (50/30/20 in `ad_payments`, 50/30/20 in `metadata_pm`) | ✅ **FIXED** | All split percentages now read from `GovernanceConfig`. During PM: 10/9/41/40; after PM success: 10/9/81/0; after PM failure: ads disabled (abort). |
| `governance_config_id` stubs (Option<ID>) in `RevenuePool`, `AdRevenuePool`, `AdCampaign` | ✅ **FIXED** | Added `set_governance_config()` admin functions in `ad_payments.move`, `metadata_pm.move`, and `ad_campaigns.move` to wire the stub to the actual `GovernanceConfig` object ID. |
| Two separate revenue distribution paths (`metadata_pm::distribute_ad_revenue` and `ad_payments::distribute_revenue`) with different splits | ✅ **FIXED** | Both now read from the same `GovernanceConfig`, using identical PM-status-aware split logic. |
| Posting fee split semantics unclear | ✅ **FIXED** | Non-Walrus remainder is now explicitly 50% Foundation + 50% PM pool (as creator YES position). New `CreatorYesBought` event documents the semantics. |
| `UPDATE_LOCK_MS` hardcoded in `dapp_posting.move` | ✅ **FIXED** | `update_dapp_metadata` reads `pm_duration_ms` from `GovernanceConfig`, floored at the legacy `UPDATE_LOCK_MS` constant. |
| `MIN_POSTING_FEE` hardcoded | ✅ **FIXED** | `post_dapp` reads `votable_posting_fee` from `GovernanceConfig`. Floor at legacy `MIN_POSTING_FEE` for safety. |

### New Structs & Events

| Module | Struct/Event | Purpose |
|--------|-------------|---------|
| `governance.move` | `GovernanceConfig` | Shared config with all votable parameters |
| `governance.move` | `GovernanceProposal` | Per-proposal shared object |
| `governance.move` | `GovernanceAdminCap` | Admin capability for governance |
| `governance.move` | `GovernanceConfigUpdated` | Emitted when simple param changes |
| `governance.move` | `GovernanceSplitsUpdated` | Emitted when split params change |
| `governance.move` | `ProposalCreated` / `ProposalExecuted` | Proposal lifecycle events |
| `dapp_posting.move` | `CreatorYesBought` | Creator's YES position bought via posting fee |
| `ad_payments.move` | `CreatorPMEscrow` | Holds creator's 41% during PM |
| `ad_payments.move` | `CreatorEscrowCreated` / `CreatorEscrowResolved` | Escrow lifecycle events |
| `merkle_verifier.move` | `VoteProofRoot` | Semantic Merkle root for governance votes |

### Creator PM Escrow Flow

During the prediction market period, the creator's 41% share of ad revenue is held in a `CreatorPMEscrow` object:

- **PM passes** → `resolve_escrow_success()` releases funds to creator.
- **PM fails** → `resolve_escrow_failure()` forfeits funds to PM pool (added to NO voter payouts).

### Updated Test Coverage

| Test File | Tests |
|-----------|-------|
| `dapp_posting_tests.move` | 9 tests (fee split, governance integration) |
| `ad_payments_tests.move` | 14 tests (PM active/passed/failed drawdowns, creator escrow resolve) |
| `metadata_pm_tests.move` | 13 tests (PM-status-aware distribution) |
| `ad_campaigns_tests.move` | 11 tests |
| `ad_tracking_tests.move` | 5 tests |
| `governance_tests.move` | 7 tests (config defaults, PM status, proposals, splits validation) |
| **Total** | **65 tests** (up from 28) |

---

## Conclusion

The Move contracts provide a solid foundation for the DLUX Ad Network with well-structured code and good separation of concerns. The governance remediation (2026-02-10) addressed the most critical architecture gaps:

**Now implemented:**
- Centralized, governable configuration via `GovernanceConfig`
- On-chain proposal + Merkle-verified vote execution
- PM-status-aware revenue splits (10/9/41/40 during PM, 10/9/81/0 after success, ads disabled after failure)
- Creator PM escrow with success/failure resolution
- Posting fee split: 50% Foundation + 50% creator YES position
- `@0x0` placeholders replaced; governance stubs wired

**Remaining items for production:**
- ZK proof verification (Groth16 or equivalent)
- Multi-sig or governance for AdminCap rotation
- Atomic impression + escrow withdrawal (rollback on failure)
- Backend integration: eligible voter registry, vote collection, Merkle tree construction, proposal execution
- Input validation refinement (coordinate ranges, quaternion normalization)
