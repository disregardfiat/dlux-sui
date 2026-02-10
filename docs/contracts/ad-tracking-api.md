# Ad Tracking Contract API

**Module:** `dlux::ad_tracking`  
**Location:** `contracts/metadata_pm/sources/ad_tracking.move`

## Overview

The Ad Tracking contract provides privacy-preserving click and conversion tracking for the DLUX ad network. It uses anonymous tokens and hash-based identification to track ad engagement without revealing user identities.

## Privacy Design

The tracking system is designed around these privacy principles:

1. **Anonymous Tokens**: Click tokens are generated from hashed data, not user IDs
2. **Hash-Based Linking**: Conversions are linked to clicks via hash, not identity
3. **Expiring Tokens**: Tokens have a 24-hour TTL to limit tracking window
4. **One-Time Use**: Each token can only be used once for conversion

## Structs

### ClickToken

Anonymous token generated when user clicks an ad.

```move
public struct ClickToken has key, store {
    id: UID,
    ad_id: ID,                 // Associated ad
    content_id: vector<u8>,    // Content where ad was shown
    token_hash: vector<u8>,    // SHA3-256 hash (anonymous identifier)
    created_at: u64,           // Creation timestamp
    expires_at: u64,           // Expiration timestamp
    is_used: bool,             // Whether used for conversion
}
```

### Conversion

Records a conversion linked to a click token.

```move
public struct Conversion has store, drop {
    click_token_hash: vector<u8>,      // Original click token hash
    conversion_token_hash: vector<u8>, // Conversion proof hash
    ad_id: ID,                         // Associated ad
    content_id: vector<u8>,            // Content where conversion occurred
    verified: bool,                    // Whether verified by system
    timestamp: u64,                    // Conversion timestamp
}
```

### ClickTokenRegistry

Shared registry tracking all tokens and conversions.

```move
public struct ClickTokenRegistry has key {
    id: UID,
    tokens: Table<vector<u8>, bool>,           // token_hash → exists
    conversions: Table<vector<u8>, Conversion>, // click_hash → conversion
    total_clicks: u64,
    total_conversions: u64,
}
```

### VerifierCap

Capability required for conversion operations.

```move
public struct VerifierCap has key, store {
    id: UID,
}
```

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_TOKEN_TTL_MS` | 86400000 | 24 hours in milliseconds |

## Events

### ClickTokenCreated

Emitted when a click token is generated.

```move
public struct ClickTokenCreated has copy, drop {
    token_id: ID,
    ad_id: ID,
    token_hash: vector<u8>,
    expires_at: u64,
}
```

### TokenVerified

Emitted when a token is verified.

```move
public struct TokenVerified has copy, drop {
    token_hash: vector<u8>,
    ad_id: ID,
    valid: bool,
}
```

### ConversionRecorded

Emitted when a conversion is recorded.

```move
public struct ConversionRecorded has copy, drop {
    click_token_hash: vector<u8>,
    conversion_token_hash: vector<u8>,
    ad_id: ID,
}
```

### ConversionVerified

Emitted when a conversion is verified.

```move
public struct ConversionVerified has copy, drop {
    click_token_hash: vector<u8>,
    ad_id: ID,
    verified: bool,
}
```

## Initialization

The module creates a `VerifierCap` and shared `ClickTokenRegistry` on deployment:

```move
fun init(ctx: &mut TxContext)
```

**Effects:**
- Creates `VerifierCap` and transfers to deployer
- Creates shared `ClickTokenRegistry`

## Functions

### create_click_token

Creates an anonymous click token for an ad click.

```move
public fun create_click_token(
    registry: &mut ClickTokenRegistry,
    ad_id: ID,
    content_id: vector<u8>,
    nonce: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext
)
```

**Parameters:**
- `registry`: Click token registry
- `ad_id`: ID of the clicked ad
- `content_id`: Content where ad was shown
- `nonce`: Random nonce for uniqueness
- `clock`: Sui Clock object
- `ctx`: Transaction context

**Token Hash Generation:**
```
token_hash = keccak256(ad_id || content_id || nonce || timestamp)
```

**Effects:**
- Generates unique token hash
- Registers token in registry
- Creates ClickToken object and transfers to sender
- Increments total_clicks
- Emits `ClickTokenCreated` event

**Errors:**
- `E_TOKEN_ALREADY_USED` (3): Token hash already exists

### verify_click_token

Verifies a click token is valid.

```move
public fun verify_click_token(
    token: &ClickToken,
    registry: &ClickTokenRegistry,
    clock: &Clock,
): bool
```

**Returns:** `true` if token is valid.

**Validation checks:**
1. Token not expired
2. Token not already used
3. Token exists in registry

### verify_token

Verifies token and emits event.

```move
public fun verify_token(
    token: &ClickToken,
    registry: &ClickTokenRegistry,
    clock: &Clock,
)
```

**Effects:**
- Calls `verify_click_token`
- Emits `TokenVerified` event with result

### record_conversion

Records a conversion linked to a click token.

```move
public fun record_conversion(
    token: &mut ClickToken,
    registry: &mut ClickTokenRegistry,
    conversion_nonce: vector<u8>,
    clock: &Clock,
    _verifier: &VerifierCap,
)
```

**Parameters:**
- `token`: Click token to convert
- `registry`: Click token registry
- `conversion_nonce`: Random nonce for conversion hash
- `clock`: Sui Clock object
- `_verifier`: Verifier capability

**Conversion Hash Generation:**
```
conversion_hash = keccak256(click_token_hash || conversion_nonce || timestamp)
```

**Effects:**
- Creates Conversion record
- Stores in registry
- Marks token as used
- Increments total_conversions
- Emits `ConversionRecorded` event

**Errors:**
- `E_TOKEN_EXPIRED` (1): Token has expired
- `E_TOKEN_ALREADY_USED` (3): Token already used
- `E_CONVERSION_EXISTS` (5): Conversion already recorded

### verify_conversion

Verifies a recorded conversion.

```move
public fun verify_conversion(
    registry: &mut ClickTokenRegistry,
    click_token_hash: vector<u8>,
    _verifier: &VerifierCap,
)
```

**Effects:**
- Sets conversion.verified to true
- Emits `ConversionVerified` event

**Errors:**
- `E_INVALID_TOKEN` (2): No conversion for this token hash

### has_conversion

Checks if a conversion exists for a click token.

```move
public fun has_conversion(
    registry: &ClickTokenRegistry,
    click_token_hash: vector<u8>,
): bool
```

### is_conversion_verified

Checks if a conversion is verified.

```move
public fun is_conversion_verified(
    registry: &ClickTokenRegistry,
    click_token_hash: vector<u8>,
): bool
```

## View Functions

### get_token_hash

```move
public fun get_token_hash(token: &ClickToken): vector<u8>
```

### get_token_ad_id

```move
public fun get_token_ad_id(token: &ClickToken): ID
```

### is_token_expired

```move
public fun is_token_expired(token: &ClickToken, clock: &Clock): bool
```

### is_token_used

```move
public fun is_token_used(token: &ClickToken): bool
```

### get_registry_stats

```move
public fun get_registry_stats(registry: &ClickTokenRegistry): (u64, u64)
```

Returns `(total_clicks, total_conversions)`.

## Tracking Flow

```
User Clicks Ad
     │
     ▼
┌─────────────────────────────────────────┐
│         create_click_token()            │
│                                         │
│  • Generate token_hash from:            │
│    - ad_id                              │
│    - content_id                         │
│    - nonce (client-provided)            │
│    - timestamp                          │
│  • Register in registry                 │
│  • Transfer token to user               │
└─────────────────────────────────────────┘
     │
     │ (User navigates to advertiser site)
     │
     ▼
┌─────────────────────────────────────────┐
│          record_conversion()            │
│                                         │
│  • Verify token not expired             │
│  • Verify token not used                │
│  • Generate conversion_hash             │
│  • Store conversion record              │
│  • Mark token as used                   │
└─────────────────────────────────────────┘
     │
     │ (Admin verification)
     │
     ▼
┌─────────────────────────────────────────┐
│         verify_conversion()             │
│                                         │
│  • Mark conversion as verified          │
│  • Ready for payout processing          │
└─────────────────────────────────────────┘
```

## Usage Examples

### Creating a Click Token

```typescript
const tx = new TransactionBlock();
const nonce = crypto.randomBytes(32);

tx.moveCall({
  target: `${PACKAGE_ID}::ad_tracking::create_click_token`,
  arguments: [
    tx.object(registryId),           // registry
    tx.pure(adId),                   // ad_id
    tx.pure(Buffer.from("content1")), // content_id
    tx.pure(nonce),                  // nonce
    tx.object(CLOCK_ID),             // clock
  ],
});
```

### Recording a Conversion

```typescript
const tx = new TransactionBlock();
const conversionNonce = crypto.randomBytes(32);

tx.moveCall({
  target: `${PACKAGE_ID}::ad_tracking::record_conversion`,
  arguments: [
    tx.object(clickTokenId),         // token
    tx.object(registryId),           // registry
    tx.pure(conversionNonce),        // conversion_nonce
    tx.object(CLOCK_ID),             // clock
    tx.object(verifierCapId),        // verifier
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

### create_token_for_testing

Creates a token without registry for testing.

```move
public fun create_token_for_testing(
    ad_id: ID,
    content_id: vector<u8>,
    token_hash: vector<u8>,
    created_at: u64,
    expires_at: u64,
    ctx: &mut TxContext
): ClickToken
```

### destroy_token_for_testing

Destroys a token object in tests.

```move
public fun destroy_token_for_testing(token: ClickToken)
```

## Privacy Guarantees

| Data Point | Stored On-Chain | Revealed |
|------------|-----------------|----------|
| User Identity | No | Never |
| Ad ID | Yes | Yes |
| Content ID | Yes | Yes |
| Click Time | Yes (in hash) | No |
| Conversion Time | Yes | Yes |
| Linkage | Hash only | No identity |

The system ensures:
- Users are never identified on-chain
- Clicks can't be linked to specific users
- Conversions prove engagement without revealing who
- All data expires after 24 hours
