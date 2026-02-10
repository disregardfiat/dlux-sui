# DLUX Move Contracts & Privacy-Preserving Ad Tracking: Technical White Paper

**Version 2.0**  
**February 2026**

## Executive Summary

This white paper describes the DLUX ecosystem's Move smart contract architecture and privacy-preserving content monetization system built on the Sui blockchain. DLUX is not merely an advertising network—it is a complete content flywheel where **any content** (dApps, posts, media) can be promoted as ads, served through the decentralized Walrus gateway/sandbox, and moderated by decentralized prediction markets (PMs). The Move contracts orchestrate the entire ecosystem: content posting, prediction market verification, ad campaign management, privacy-preserving tracking, and revenue distribution.

The system enables verifiable impression tracking, click-through measurement, and revenue distribution while maintaining strong privacy guarantees through zero-knowledge proofs, Merkle tree batch verification, and homomorphic encryption. All user engagement data is processed without revealing individual user identities, ensuring GDPR compliance and user privacy protection.

**Key Innovations:**
- **Content-as-Ads**: Any content that runs in the Walrus gateway can be promoted as an ad—dApps, posts, media, interactive experiences
- **Decentralized PM Verification**: All content (including ads) requires prediction market verification before approval, ensuring community-driven quality control
- **Privacy-First Tracking**: Zero-knowledge proofs and homomorphic encryption ensure user identities are never revealed
- **Offline Batch Verification**: Merkle tree aggregation allows efficient on-chain verification of thousands of impressions
- **Cryptographic Revenue Distribution**: Trustless revenue sharing that incentivizes truth-seeking through prediction markets
- **Anonymous Click Tokens**: Hash-based token system for conversion tracking without identity linkage
- **Complete Content Flywheel**: Contracts orchestrate posting → PM verification → ad campaigns → tracking → revenue distribution → storage funding

---

## 1. Introduction

### 1.1 Background

Traditional digital advertising systems face fundamental privacy and trust challenges:
- **Privacy Violations**: User behavior is tracked across sites, creating detailed profiles
- **Lack of Verifiability**: Advertisers cannot cryptographically verify that impressions occurred
- **Centralized Control**: Platforms control both tracking and payment, creating trust dependencies
- **Data Leakage**: User identities are exposed in analytics and payment flows
- **Content Moderation**: Centralized platforms arbitrarily decide what content can be monetized
- **Limited Content Types**: Only static banner ads or simple media, not interactive experiences

DLUX addresses these issues by combining blockchain-based smart contracts with advanced cryptographic privacy techniques, creating a verifiable yet privacy-preserving content monetization ecosystem. Unlike traditional ad networks, DLUX treats **ads as first-class content**—any dApp, post, or interactive experience can be promoted as an ad, served through the decentralized Walrus gateway, and verified by community-driven prediction markets.

### 1.2 The DLUX Content Flywheel

The DLUX ecosystem operates as a complete content flywheel, not just an advertising system:

1. **Content Creation**: Creators post dApps, posts, or media to the platform
2. **PM Verification**: Decentralized prediction markets verify content safety and quality
3. **Ad Promotion**: Verified content can be promoted as ads (any content can be an ad)
4. **Walrus Serving**: Content is served through decentralized Walrus gateway/sandbox
5. **Privacy-Preserving Tracking**: ZK proofs and Merkle trees track engagement without revealing identities
6. **Revenue Distribution**: Revenue flows based on PM status—active PMs incentivize safety reviews, passed PMs reward creators
7. **Storage Funding**: Revenue funds Walrus storage terms, creating sustainable content hosting

The Move contracts orchestrate this entire flywheel, ensuring trustless verification, privacy-preserving tracking, and incentive-aligned revenue distribution.

### 1.3 Design Principles

The system is built on six core principles:

1. **Content-as-Ads**: Any content that runs in the Walrus gateway can be promoted as an ad—no distinction between content and advertising
2. **Decentralized Moderation**: Prediction markets moderate all content (including ads), ensuring community-driven quality control
3. **Privacy by Design**: User identities are never stored or revealed in tracking or payment flows
4. **Cryptographic Verifiability**: All impressions and conversions are provably verifiable on-chain
5. **Efficient Batching**: Offline aggregation enables cost-effective on-chain settlement
6. **Trustless Distribution**: Revenue distribution is enforced by smart contracts, with PM status determining recipient allocation

---

## 2. System Architecture Overview

### 2.1 The Complete Content Flywheel

```
┌─────────────────────────────────────────────────────────────┐
│                    Content Creation Layer                    │
│                                                              │
│  Creators post: dApps, posts, media, interactive content    │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │   Walrus Gateway/Sandbox             │                  │
│  │   • Address-matched subdomains       │                  │
│  │   • Secure dApp execution            │                  │
│  │   • Script injection (wallet, ads)   │                  │
│  │   • Any content can run as ad        │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │   Prediction Market Verification      │                  │
│  │   • All content requires PM approval  │                  │
│  │   • Community bets on safety/quality  │                  │
│  │   • Capital-weighted resolution       │                  │
│  │   • PM status determines revenue flow │                  │
│  └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Offline Tracking Layer                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   ZK Proof   │  │   Merkle     │  │ Homomorphic   │   │
│  │  Generation  │→ │   Tree       │→ │ Aggregation   │   │
│  │              │  │   Building    │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                  │                  │           │
│         └──────────────────┼──────────────────┘           │
│                            │                              │
└────────────────────────────┼──────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  On-Chain Verification Layer                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Merkle     │  │   Revenue    │  │   Escrow     │   │
│  │  Verifier    │→ │   Pool       │→ │  Management  │   │
│  │              │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                  │                  │           │
│         └──────────────────┼──────────────────┘           │
│                            │                              │
│              PM-Aware Revenue Distribution                 │
│  ┌────────────────────────────────────────────┐         │
│  │  PM Active (status=0):                     │         │
│  │    Foundation: 10%                         │         │
│  │    Gateway: 9%                              │         │
│  │    Creator: 41% (escrow)                    │         │
│  │    PM Pool: 40% (incentivize)              │         │
│  │  PM Passed (status=1):                      │         │
│  │    Foundation: 10%                          │         │
│  │    Gateway: 9%                              │         │
│  │    Creator: 81% (released)                  │         │
│  │    PM Pool: 0%                              │         │
│  │  PM Failed (status=2): Aborts               │         │
│  └────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Funding Layer                      │
│                                                              │
│  Revenue → Walrus Storage Terms → Sustainable Hosting       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Overview

#### 2.2.1 Move Contract Modules

The system consists of seven main Move contract modules:

1. **`metadata_pm`**: Revenue pool management and Merkle root verification
2. **`ad_campaigns`**: Campaign lifecycle and impression recording
3. **`ad_payments`**: Escrow management and PM-aware revenue distribution
4. **`ad_tracking`**: Privacy-preserving click and conversion tracking
5. **`merkle_verifier`**: Shared Merkle proof verification utilities
6. **`dapp_posting`**: Content posting with PM trigger and storage cost calculation
7. **`governance`**: On-chain governance for votable parameters and revenue splits

#### 2.2.2 Infrastructure Components

**Walrus Gateway/Sandbox:**
- **Purpose**: Decentralized content serving and execution environment
- **Address-Matched Subdomains**: `h{hex}.walrus.dlux.io` proves content ownership
- **Content Types**: Any content that runs in the gateway can be an ad (dApps, posts, media, interactive experiences)
- **Security**: Sandboxed execution, script injection (wallet, navigation, ads), asset proxying
- **Ad Display**: Pre-dApp ads, algorithmic feed integration, install prompts

**Prediction Market Service:**
- **Purpose**: Decentralized content moderation and quality verification
- **Scope**: All content (including ads) requires PM verification
- **Resolution**: Capital-weighted (most capital wins)
- **Impact**: PM status determines revenue recipient (PM pool vs creator)
- **Metrics**: Safety metrics (nsfw, malware, phishing) and quality metrics (ad-quality)

**DGraph Service:**
- **Purpose**: Off-chain data layer for impressions, Merkle trees, and PM status
- **Functions**: Stores ZK proofs, builds Merkle trees, tracks PM status, aggregates analytics

**Sui Service:**
- **Purpose**: On-chain transaction orchestration
- **Functions**: Calls Move contracts, manages escrows, distributes revenue, checks PM status

---

## 3. Move Contracts Architecture

### 3.1 Module: `dlux::metadata_pm`

**Purpose**: Manages ad revenue pools for content creators with Merkle root-based verification.

#### Core Data Structures

```move
public struct AdRevenuePool has key {
    id: UID,
    content_id: vector<u8>,
    creator: address,
    balance: Balance<SUI>,
    total_revenue: u64,
    distributed: bool,
    merkle_root: Option<MerkleRoot>,
    paused: bool,
    governance_config_id: Option<ID>,
}
```

**Key Features:**
- **Creator-Controlled Pools**: Each content creator has their own revenue pool
- **Merkle Root Verification**: Requires verified Merkle root before distribution
- **Pause Mechanism**: Creators can pause pools to prevent distribution during exploits
- **Governance-Aware Revenue Split**: Revenue splits are read from `GovernanceConfig` based on PM status
  - **PM Active**: Foundation 10%, Gateway 9%, Creator 41% (escrow), PM Pool 40%
  - **PM Passed**: Foundation 10%, Gateway 9%, Creator 81%, PM Pool 0%
  - **PM Failed**: Ads disabled (aborts distribution)

#### Critical Functions

**`create_revenue_pool`**: Creates a new revenue pool with initial SUI deposit
- Validates content ID length (max 64 bytes)
- Emits `PoolCreated` event for indexers

**`set_merkle_root`**: Admin-only function to set Merkle root after threshold reached
- Validates root matches pool's content_id
- Ensures leaf_count >= threshold
- Can only be set once per pool

**`distribute_ad_revenue`**: Distributes revenue after Merkle verification
- Verifies batch of Merkle proofs on-chain
- Requires at least 10% of threshold proofs in batch
- Enforces path depth limits (max 40 levels)
- Reads revenue splits from `GovernanceConfig` based on PM status
- PM status: 0 = active, 1 = passed, 2 = failed (aborts)
- Aborts if PM failed (ads disabled)

### 3.2 Module: `dlux::ad_campaigns`

**Purpose**: Manages advertising campaign lifecycle, targeting, and impression tracking.

#### Core Data Structures

```move
public struct AdCampaign has key, store {
    id: UID,
    advertiser: address,
    title: vector<u8>,
    description: vector<u8>,
    target_url: vector<u8>,
    placements: vector<vector<u8>>,
    bid: u64,
    total_budget: u64,
    remaining_budget: u64,
    status: u8,
    start_at: u64,
    end_at: u64,
    user_zones: vector<vector<u8>>,
    content_zones: vector<vector<u8>>,
    planet: Option<u8>,
    escrow_id: Option<ID>,
    last_metadata_update_ts: u64,
}
```

**Campaign Status States:**
- `STATUS_ACTIVE` (0): Campaign is running
- `STATUS_PAUSED` (1): Campaign paused by advertiser
- `STATUS_CANCELLED` (2): Campaign cancelled, refund pending
- `STATUS_EXPIRED` (3): Campaign end date passed
- `STATUS_BUDGET_DEPLETED` (4): Budget exhausted
- `STATUS_PAUSED_BY_OWNER` (5): Owner-paused (stops all impressions)

**Key Features:**
- **Escrow Integration**: Campaigns link to `CampaignEscrow` for fund management
- **Targeting Support**: GeoIP zones, content zones, and planet-based targeting
- **Metadata Cooldown**: 7-day cooldown between metadata updates (prevents abuse)
- **Automatic Status Transitions**: Expires or depletes budget automatically
- **Governance Integration**: Future support for governance overrides via `governance_override_id`

#### Critical Functions

**`create_campaign`**: Creates new campaign with escrow
- Validates bid, budget, and date ranges
- Creates `CampaignEscrow` with minimum 24-hour lock
- Enforces placement and zone limits (max 32 each)

**`record_impression_with_escrow`**: Records impression and withdraws from escrow
- Calls `deduct_impression_cost` to update campaign state
- Requires Merkle proof verification via `ad_payments::withdraw_for_impression`
- Automatically transitions to `STATUS_BUDGET_DEPLETED` when budget insufficient

**`pause_by_owner`**: Advertiser can pause to stop all impressions
- Prevents further escrow withdrawals
- Can be resumed with `resume_from_owner_pause`

### 3.3 Module: `dlux::ad_payments`

**Purpose**: Manages campaign escrows, revenue pools, and payment distribution.

#### Core Data Structures

```move
public struct CampaignEscrow has key {
    id: UID,
    campaign_id: ID,
    advertiser: address,
    balance: Balance<SUI>,
    total_deposited: u64,
    total_withdrawn: u64,
    locked_until: u64,
    is_finalized: bool,
    paused: bool,
}

public struct RevenuePool has key {
    id: UID,
    balance: Balance<SUI>,
    total_collected: u64,
    last_distribution: u64,
    paused: bool,
    creator: address,
    governance_config_id: Option<ID>,
}

public struct CreatorPMEscrow has key {
    id: UID,
    dapp_id: vector<u8>,
    creator: address,
    balance: Balance<SUI>,
    total_escrowed: u64,
    resolved: bool,
}
```

**Key Features:**
- **Time-Locked Escrows**: Minimum 24-hour lock prevents immediate refunds
- **Pause Controls**: Both escrows and pools can be paused independently
- **Walrus Drawdown**: Supports Walrus node batch withdrawals with Merkle verification

#### Critical Functions

**`create_escrow`**: Creates escrow for campaign funds
- Sets `locked_until` timestamp based on `lock_duration_ms`
- Emits `EscrowCreated` event

**`withdraw_for_impression`**: Withdraws from escrow for verified impression
- Requires Merkle proof verification
- Minimum withdrawal: 100,000 MIST (prevents dust attacks)
- Transfers funds to `RevenuePool`
- Validates proof count (max 100 proofs per batch)

**`walrus_drawdown`**: Walrus node batch withdrawal from revenue pool
- **PM-Aware Revenue Split** (read from `GovernanceConfig`):
  - **PM Active (status=0)**:
    - 10% → Foundation
    - 9% → Gateway/Walrus provider
    - 41% → Creator escrow (held until PM resolves)
    - 40% → PM Pool (incentivizes safety reviews)
  - **PM Passed (status=1)**:
    - 10% → Foundation
    - 9% → Gateway/Walrus provider
    - 81% → Creator (released from escrow)
    - 0% → PM Pool
  - **PM Failed (status=2)**: Aborts — ads disabled
- Requires Merkle proof verification
- Creator escrow mechanism: During PM, creator share is held in `CreatorPMEscrow`; released to creator if PM passes, forfeited to PM pool if PM fails

**`create_creator_escrow`**: Creates escrow for creator's share during PM
- Admin-only (requires `AdminCap`)
- Created when dApp is posted and PM starts
- Shared object, can be accessed by multiple drawdowns

**`resolve_escrow_success`**: Releases escrow to creator when PM passes
- Admin-only
- Transfers all escrowed balance to creator
- Marks escrow as resolved

**`resolve_escrow_failure`**: Forfeits escrow to PM pool when PM fails
- Admin-only
- Transfers all escrowed balance to PM pool
- Marks escrow as resolved

**`distribute_revenue`**: Standard revenue distribution (for metadata_pm pools)
- Reads splits from `GovernanceConfig` based on PM status
- Same PM-aware logic as `walrus_drawdown`
- Fixed recipient addresses (no redirect risk)

### 3.4 Module: `dlux::ad_tracking`

**Purpose**: Privacy-preserving click and conversion tracking using anonymous tokens.

#### Core Data Structures

```move
public struct ClickToken has key, store {
    id: UID,
    ad_id: ID,
    content_id: vector<u8>,
    token_hash: vector<u8>,  // SHA3-256 hash
    created_at: u64,
    expires_at: u64,
    is_used: bool,
}

public struct Conversion has store, drop {
    click_token_hash: vector<u8>,
    conversion_token_hash: vector<u8>,
    ad_id: ID,
    content_id: vector<u8>,
    verified: bool,
    timestamp: u64,
}
```

**Privacy Guarantees:**
- **No User Identity**: Tokens are hash-based, not linked to addresses
- **24-Hour TTL**: Tokens expire after 24 hours
- **One-Time Use**: Each token can only be used once for conversion
- **Hash-Based Linking**: Conversions linked via hash, not identity

#### Critical Functions

**`create_click_token`**: Creates anonymous click token
- Token hash: `keccak256(ad_id || content_id || nonce || timestamp)`
- 5-minute cooldown per sender (prevents spam)
- Registers token in shared `ClickTokenRegistry`

**`record_conversion`**: Records conversion linked to click token
- Conversion hash: `keccak256(click_token_hash || conversion_nonce || timestamp)`
- Marks token as used (prevents double-counting)
- Admin-only (requires `AdminCap`)

**`verify_conversion`**: Admin verification of conversion
- Sets `verified: true` flag
- Used for analytics and payout eligibility

### 3.5 Module: `dlux::merkle_verifier`

**Purpose**: Shared Merkle tree verification utilities used by multiple modules. Supports both ad impression verification and governance vote verification.

#### Core Data Structures

```move
public struct MerkleRoot has store, drop {
    content_id: vector<u8>,
    root_hash: vector<u8>,
    leaf_count: u64,
    threshold: u64,
}
```

**Key Features:**
- **SHA3-256 Hashing**: Uses Keccak256 for Merkle tree construction
- **Batch Verification**: Verifies multiple proofs in single call
- **Path Depth Limits**: Maximum 40 levels (gas/DoS protection)
- **Threshold Enforcement**: Requires `leaf_count >= threshold`

#### Critical Functions

**`verify_merkle_inclusion`**: Verifies single Merkle proof
- Takes leaf hash, path (sibling hashes), indices (left/right), and root
- Reconstructs path from leaf to root
- Returns `true` if computed root matches provided root

**`verify_batch_ad_views`**: Verifies batch of ad view proofs
- Validates all proofs belong to same Merkle root
- Enforces proof count limits (max 100)
- Enforces path depth limits (max 40)
- Returns `true` only if all proofs valid

**`verify_batch_votes`**: Verifies batch of governance vote proofs
- Uses same Merkle verification algorithm as ad views
- Validates vote proofs for governance proposals
- Used by `governance` module for proposal execution

### 3.6 Module: `dlux::governance`

**Purpose**: On-chain governance system for votable platform parameters. Centralizes all configurable parameters (PM duration, posting fees, revenue splits) in a single shared `GovernanceConfig` object.

#### Core Data Structures

```move
public struct GovernanceConfig has key {
    id: UID,
    pm_duration_ms: u64,              // Default: 3 days
    votable_posting_fee: u64,          // Default: 1 SUI
    // PM-period splits (must sum to 100)
    pm_foundation_pct: u64,            // Default: 10
    pm_gateway_pct: u64,               // Default: 9
    pm_creator_pct: u64,               // Default: 41 (held in escrow)
    pm_pool_pct: u64,                  // Default: 40
    // Post-PM-success splits (must sum to 100)
    post_foundation_pct: u64,          // Default: 10
    post_gateway_pct: u64,             // Default: 9
    post_creator_pct: u64,            // Default: 81
    post_pm_pct: u64,                  // Default: 0
    proposal_duration_ms: u64,         // Default: 7 days
    quorum_pct: u64,                   // Default: 51
    last_updated_ms: u64,
}

public struct GovernanceProposal has key {
    id: UID,
    proposer: address,
    param_key: vector<u8>,             // e.g., "pm_duration_ms", "pm_splits"
    param_value: u64,                  // For simple params
    split_values: vector<u64>,        // [foundation, gateway, creator, pool] for splits
    eligible_voters_root: vector<u8>,  // Merkle root of eligible voters
    eligible_voter_count: u64,
    created_at_ms: u64,
    expires_at_ms: u64,
    executed: bool,
}
```

**Key Features:**
- **Single Source of Truth**: All votable parameters in one shared object
- **Merkle Vote Verification**: Uses same Merkle verification as ad impressions
- **Quorum Enforcement**: Requires 51% of eligible voters (default)
- **Majority Rule**: YES votes must exceed NO votes
- **Split Validation**: Revenue splits must sum to 100%

#### Critical Functions

**`create_proposal`**: Creates a governance proposal
- Admin-only (requires `GovernanceAdminCap`)
- Validates split proposals sum to 100%
- Sets expiration based on `proposal_duration_ms`
- Stores Merkle root of eligible voters

**`execute_proposal`**: Executes a proposal after voting window
- Verifies Merkle proofs of votes (sample verification)
- Checks quorum: `total_votes >= (eligible_voter_count * quorum_pct) / 100`
- Requires YES majority: `yes_count > no_count`
- Applies parameter change to `GovernanceConfig`
- Emits `ProposalExecuted` event

**Reader Functions**: Used by other modules to read config values
- `get_pm_duration`, `get_votable_fee`
- `get_pm_foundation_pct`, `get_pm_gateway_pct`, `get_pm_creator_pct`, `get_pm_pool_pct`
- `get_post_foundation_pct`, `get_post_gateway_pct`, `get_post_creator_pct`, `get_post_pm_pct`

**Votable Parameters:**
- **Simple Parameters**: `pm_duration_ms`, `votable_posting_fee`, `proposal_duration_ms`, `quorum_pct`
- **Split Parameters**: `pm_splits` (4-element vector), `post_splits` (4-element vector)

**Eligible Voters**: Determined off-chain by backend
- Top-half creators by revenue
- Equal number of top PM earners
- Merkle root of eligible addresses built off-chain

### 3.7 Module: `dlux::dapp_posting`

**Purpose**: Content posting with PM trigger, storage cost calculation, and fee distribution.

#### Core Data Structures

```move
public struct PostingTreasuryConfig has key {
    id: UID,
    pm_pool_address: address,
    foundation_address: address,
    walrus_storage_fund_address: address,
}

public struct PostingFeePool has key {
    id: UID,
    balance: Balance<SUI>,
    total_collected: u64,
}

public struct DappRegistry has key {
    id: UID,
    claimed: Table<vector<u8>, bool>,  // (owner, permlink) -> claimed
    records: Table<vector<u8>, DappRecord>,  // dapp_id -> record
}
```

**Key Features:**
- **Storage Cost Calculation**: On-chain calculation from blob sizes
  - Formula: `(total_bytes * COST_PER_GB_PER_YEAR_MIST * TERM_LENGTH_DAYS) / (BYTES_PER_GB * 365)`
  - Default: 0.01 SUI per GB per year, 2-year term
- **Fee Structure**: `total_fee >= 2 × walrus_storage_cost + governance.votable_posting_fee`
- **Fee Distribution**:
  - Storage cost → Walrus storage fund
  - Remainder: 50% Foundation, 50% PM pool (creator YES position)
- **Update Lock**: 3-day minimum (uses governance PM duration, floored)
- **Mute Functionality**: Creators can mute dApps to reduce ads/viewers

#### Critical Functions

**`post_dapp`**: Posts a dApp on-chain
- Validates inputs (name, permlink, blob_ids, sizes)
- Calculates storage cost from blob sizes
- Validates fee: `fee >= 2 × storage_cost + votable_fee`
- Checks duplicate (owner, permlink)
- Distributes fee: storage → Walrus fund, remainder → 50/50 Foundation/PM pool
- Emits `DappPosted`, `PredictionMarketTriggered`, `CreatorYesBought` events
- Stores record for time lock and mute

**`update_dapp_metadata`**: Updates metadata after lock period
- Only owner can update
- Lock duration from `GovernanceConfig.pm_duration_ms` (floored at 3 days)
- Emits `DappMetadataUpdated` event for indexers

**`set_muted`**: Creator mutes/unmutes their dApp
- Visible to indexers
- Reduces ads/viewers/slashing
- Can mitigate bugs while PM resolves

---

## 4. Walrus Gateway & Content-as-Ads Architecture

### 4.1 Walrus Gateway/Sandbox

The Walrus gateway is the decentralized infrastructure that serves all content in the DLUX ecosystem. Unlike traditional ad networks that serve static banners or simple media, **any content that runs in the Walrus gateway can be promoted as an ad**.

#### 4.1.1 Address-Matched Subdomains

**Security Model:**
- Content is served via address-matched subdomains: `h{hex}.walrus.dlux.io`
- The subdomain proves content ownership—only content posted by that address can be served
- DNS labels limited to 63 chars (RFC 1035), so format is `h` + up to 62 hex chars
- Example: `h1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef12.walrus.dlux.io`

**Content Flow:**
1. Sandbox calls `dapps/lookup(author, permlink)` to verify ownership
2. Validates `addressSubdomain(lookup.owner) === subdomain`
3. Returns 403 if mismatch (prevents content spoofing)
4. Fetches blob IDs from Walrus storage
5. Injects scripts (wallet, navigation, social, ads)
6. Rewrites blob URLs to same-origin `/walrus/:blobId`

#### 4.1.2 Content Types as Ads

**Any content can be an ad:**
- **dApps**: Full interactive applications (games, tools, experiences)
- **Posts**: Text, images, videos, media content
- **Folder Uploads**: Multi-file projects with `manifest.pathMap`
- **Remix Content**: User-modified versions of existing content

**Ad Display Mechanisms:**
- **Pre-dApp Display**: Ads shown before users access dApp content
- **Algorithmic Feed Integration**: Ads intermixed in content feeds
- **Install Prompts**: Ads shown before PWA installation prompts
- **Gate Content**: Ads gate access to premium content

#### 4.1.3 Sandbox Security Features

- **Script Injection**: Wallet integration, navigation, social features, ad tracking
- **Asset Proxying**: Same-origin asset serving via `/walrus/:blobId`
- **Sandboxed Execution**: Isolated environment prevents malicious code
- **Consent Enforcement**: Explicit user consent before ad tracking

### 4.2 Prediction Market Verification Requirement

**All content (including ads) requires PM verification before approval:**

#### 4.2.1 PM Creation Flow

1. **Content Posted**: Creator posts dApp, post, or media
   - Fee structure: `total_fee >= 2 × walrus_storage_cost + governance.votable_posting_fee`
   - Storage cost calculated on-chain from blob sizes
   - Storage cost → Walrus storage fund
   - Remainder split: 50% Foundation, 50% PM pool (creator YES position)
2. **PM Triggered**: 50% of posting fee remainder goes to prediction market (buys creator YES position)
3. **Market Created**: PM service creates market with safety/quality metrics
4. **Community Betting**: Users bet on content safety and quality
5. **Resolution**: Market resolves after duration (from `GovernanceConfig.pm_duration_ms`, default 3 days)
6. **Approval Status**: Content approved if PM resolves as "safe"

#### 4.2.2 PM Status Impact on Revenue

**PM Active (status=0):**
- Revenue split (from `GovernanceConfig`): Foundation 10%, Gateway 9%, Creator 41% (escrow), PM Pool 40%
- Creator share held in `CreatorPMEscrow` until PM resolves
- Incentivizes community safety reviews
- PM pool receives 40% to sweeten the pot

**PM Passed (status=1):**
- Revenue split (from `GovernanceConfig`): Foundation 10%, Gateway 9%, Creator 81%, PM Pool 0%
- Creator escrow released to creator
- Rewards verified safe content
- Content has proven community trust

**PM Failed (status=2):**
- Ads disabled (all distribution functions abort)
- Creator escrow forfeited to PM pool
- Protects users from unsafe content
- Content may be deprioritized or paused

#### 4.2.3 Decentralized Moderation

**PMs moderate all content, not just ads:**
- **Safety Metrics**: nsfw, age-restricted, malware, phishing, scam
- **Quality Metrics**: ad-quality, content-quality, user-experience
- **Capital-Weighted Resolution**: Most capital wins (prevents manipulation)
- **Community-Driven**: No centralized moderation authority

---

## 5. Privacy-Preserving Tracking Mechanisms

### 4.1 Zero-Knowledge Proof Verification

**Architecture**: Client-side ZK proof generation using Circom circuits.

**Process Flow:**
1. User views ad in sandbox environment
2. Client generates ZK proof proving:
   - Ad was displayed
   - Content ID matches
   - Block header is valid
   - **Private witness**: User identity (never revealed)
3. Proof submitted to DGraph service (off-chain)
4. Proof hash stored in Merkle tree leaf
5. Merkle root computed after threshold reached
6. On-chain verification validates batch without revealing identities

**Privacy Properties:**
- User identity is private witness in ZK proof
- Only proof hash (not identity) stored on-chain
- Batch verification aggregates without decryption
- Individual user behavior cannot be traced

### 4.2 Merkle Tree Batch Aggregation

**Purpose**: Efficiently verify thousands of impressions in single on-chain transaction.

**Construction Process:**
1. **Leaf Generation**: Each ad impression creates leaf hash
   ```
   leaf_hash = keccak256(proof_hash || content_id || ad_id || timestamp)
   ```

2. **Tree Building**: Off-chain service builds Merkle tree
   - Binary tree structure
   - Parent hash = keccak256(left_child || right_child)
   - Root hash represents entire batch

3. **Threshold Enforcement**: Tree only finalized when `leaf_count >= threshold`
   - Typical threshold: 100-1000 impressions
   - Prevents premature distribution

4. **Batch Verification**: On-chain verifies subset of proofs
   - Requires at least 10% of threshold proofs
   - Validates all proofs belong to same root
   - Single transaction verifies entire batch

**Efficiency Gains:**
- **Gas Savings**: Single transaction verifies 100+ impressions
- **Scalability**: Can handle millions of impressions efficiently
- **Cost Reduction**: ~$0.001 per impression (vs $0.01+ for individual verification)

### 4.3 Homomorphic Encryption Aggregation

**Purpose**: Compute aggregate statistics without decrypting individual data.

**Cryptographic Scheme**: Paillier homomorphic encryption

**Process:**
1. **Encryption**: Each impression encrypts value `1` using public key
   ```
   encrypted_value = Paillier.encrypt(1, public_key)
   ```

2. **Aggregation**: Off-chain service adds encrypted values
   ```
   encrypted_sum = encrypted_1 + encrypted_2 + ... + encrypted_n
   ```
   Homomorphic property: `E(a) + E(b) = E(a + b)`

3. **Decryption**: Foundation/admin decrypts only final sum
   ```
   total_impressions = Paillier.decrypt(encrypted_sum, private_key)
   ```

4. **Verification**: Merkle root provides cryptographic proof of count

**Privacy Properties:**
- Individual viewer identities never decrypted
- Only aggregate counts revealed
- GDPR-compliant analytics
- No individual profiling possible

### 4.4 Anonymous Click Tokens

**Purpose**: Track click-through rates and conversions without identity linkage.

**Token Generation:**
```
token_hash = keccak256(ad_id || content_id || nonce || timestamp)
```

**Properties:**
- **Unlinkability**: Cannot link token to user identity
- **Expiration**: 24-hour TTL limits tracking window
- **One-Time Use**: Prevents double-counting conversions
- **Hash-Based**: No on-chain identity storage

**Conversion Tracking:**
```
conversion_hash = keccak256(click_token_hash || conversion_nonce || timestamp)
```

**Privacy Guarantees:**
- Click tokens don't reveal user identity
- Conversions linked via hash, not identity
- Advertisers see aggregate CTR/conversion rates only
- Individual user behavior remains private

---

## 6. Offline Tracking & Verification Flow

### 5.1 Impression Tracking Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Ad Display (Client-Side)                            │
│                                                              │
│  User views ad in sandbox                                    │
│  ↓                                                           │
│  Client generates ZK proof:                                 │
│    - Public: ad_id, content_id, block_header                │
│    - Private: user_identity (witness)                       │
│  ↓                                                           │
│  Proof submitted to DGraph (off-chain)                       │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Offline Aggregation (DGraph Service)                │
│                                                              │
│  Store proof hash:                                          │
│    proof_hash = keccak256(zk_proof)                         │
│  ↓                                                           │
│  Encrypt viewer identity:                                   │
│    encrypted_viewer = Paillier.encrypt(identity)            │
│  ↓                                                           │
│  Add to Merkle tree leaf:                                   │
│    leaf = keccak256(proof_hash || content_id || ...)        │
│  ↓                                                           │
│  Build Merkle tree (off-chain)                              │
│  ↓                                                           │
│  When threshold reached:                                    │
│    - Compute Merkle root                                    │
│    - Set root in AdRevenuePool                              │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: On-Chain Verification (Move Contract)              │
│                                                              │
│  Admin calls set_merkle_root:                              │
│    - Validates root matches content_id                      │
│    - Ensures leaf_count >= threshold                       │
│  ↓                                                           │
│  Admin calls distribute_ad_revenue:                        │
│    - Submits batch of Merkle proofs                        │
│    - Verifies proofs on-chain                              │
│    - Reads PM status from PM service                       │
│    - Reads revenue splits from GovernanceConfig            │
│    - Distributes revenue based on PM status                │
│    - PM Active: 10/9/41(escrow)/40 split                  │
│    - PM Passed: 10/9/81/0 split                           │
│    - PM Failed: Aborts                                    │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 Click & Conversion Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Click Token Creation                                │
│                                                              │
│  User clicks ad → Walrus gateway                            │
│  ↓                                                           │
│  Gateway enforces consent                                   │
│  ↓                                                           │
│  Create click token on-chain:                               │
│    token_hash = keccak256(ad_id || content_id || nonce || ts)│
│  ↓                                                           │
│  Token stored in ClickTokenRegistry                         │
│  ↓                                                           │
│  Redirect to advertiser with token                         │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Conversion Recording                                │
│                                                              │
│  Advertiser redirects conversion to gateway                │
│  ↓                                                           │
│  Gateway verifies click token:                              │
│    - Not expired (< 24 hours)                               │
│    - Not already used                                       │
│    - Exists in registry                                    │
│  ↓                                                           │
│  Record conversion on-chain:                                │
│    conversion_hash = keccak256(token_hash || nonce || ts)   │
│  ↓                                                           │
│  Mark token as used                                         │
│  ↓                                                           │
│  Admin verifies conversion (for analytics)                  │
└───────────────────────────────────────────────────────────────┘
```

### 6.3 Revenue Distribution Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Campaign Escrow → Revenue Pool                              │
│                                                              │
│  record_impression_with_escrow:                            │
│    - Deducts bid from campaign budget                       │
│    - Verifies Merkle proof                                  │
│    - Withdraws from CampaignEscrow                          │
│    - Deposits to RevenuePool                                │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Check PM Status (via PM Service)                            │
│                                                              │
│  Query: GET /markets/dapp/{contentId}                       │
│    - PM Active: status=0 (market open)                      │
│    - PM Passed: status=1 (resolved safe)                    │
│    - PM Failed: status=2 (resolved unsafe)                   │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌──────────────────────┐          ┌──────────────────────┐
│ PM Active (status=0) │          │ PM Passed (status=1) │
│                      │          │                       │
│ walrus_drawdown:     │          │ walrus_drawdown:      │
│  • 10% → Foundation  │          │  • 10% → Foundation  │
│  • 9% → Gateway      │          │  • 9% → Gateway       │
│  • 41% → Creator     │          │  • 81% → Creator      │
│    (escrow)          │          │    (released)         │
│  • 40% → PM Pool     │          │  • 0% → PM Pool       │
│    (incentivize)     │          │                       │
└──────────────────────┘          └──────────────────────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Standard Distribution (metadata_pm pools)                 │
│                                                              │
│  distribute_ad_revenue:                                     │
│    - Verifies Merkle root set                              │
│    - Verifies batch proofs                                  │
│    - Reads PM status                                        │
│    - Reads splits from GovernanceConfig                    │
│    - Same PM-aware splits as walrus_drawdown               │
│    - PM Failed (status=2): Aborts                          │
└───────────────────────────────────────────────────────────────┘
```

**Key Insight**: The revenue distribution mechanism is **PM-aware and governance-controlled**. Revenue splits are read from `GovernanceConfig` based on PM status, making them votable by the community. The creator escrow mechanism ensures creators are incentivized to produce safe content:

- **PM Active (status=0)**: Creator's 41% share is held in `CreatorPMEscrow` until PM resolves. PM pool receives 40% to incentivize safety reviews.
- **PM Passed (status=1)**: Creator escrow is released (41% → 81% total), rewarding verified safe content. PM pool receives 0%.
- **PM Failed (status=2)**: Creator escrow is forfeited to PM pool, ads are disabled, protecting users from unsafe content.

This creates a self-reinforcing flywheel where:
- **Unsafe content** → PMs stay active → Revenue goes to PM pool → More incentives for safety reviews
- **Safe content** → PMs pass → Revenue goes to creators → Rewards quality content
- **Governance control** → Community can vote to adjust splits, PM duration, posting fees → Adapts to ecosystem needs

---

## 7. Security Guarantees

### 7.1 Privacy Guarantees

| Data Point | Stored On-Chain | Revealed | Privacy Protection |
|------------|----------------|----------|-------------------|
| User Identity | No | Never | ZK proofs hide identity |
| Ad Views | Hash only | Aggregate only | Merkle aggregation |
| Click Tokens | Hash only | No identity | Anonymous tokens |
| Conversions | Hash only | Aggregate only | Hash-based linking |
| Viewer Location | Encrypted | Aggregate GeoIP | Homomorphic encryption |

**Formal Privacy Properties:**
1. **Unlinkability**: Individual ad views cannot be linked to user identities
2. **Anonymity**: Click tokens provide k-anonymity (k = total clicks)
3. **Forward Privacy**: Expired tokens cannot be used for tracking
4. **Aggregate-Only Analytics**: Only aggregate statistics revealed, never individual data

### 7.2 Verifiability Guarantees

**Cryptographic Proofs:**
- **ZK Proofs**: Prove ad was viewed without revealing viewer
- **Merkle Proofs**: Prove impression belongs to verified batch
- **Hash Chains**: Prove conversion linked to click without identity

**On-Chain Verification:**
- All revenue distributions require Merkle root verification
- Batch proofs verified atomically (all-or-nothing)
- Threshold enforcement prevents premature distribution

### 7.3 Economic Security

**Escrow Protection:**
- Minimum 24-hour lock prevents immediate refunds
- Advertiser can pause escrow to prevent withdrawals
- Finalization prevents further operations

**Revenue Protection:**
- Creator can pause pool to prevent distribution during exploits
- Merkle root can only be set once (prevents manipulation)
- Fixed revenue splits enforced by smart contract

**DoS Protection:**
- Proof count limits (max 100 per batch)
- Path depth limits (max 40 levels)
- Minimum withdrawal amounts (100k MIST)
- Cooldown periods (5 min for tokens, 7 days for metadata)

---

## 8. Gas Efficiency & Scalability

### 7.1 Batch Verification Efficiency

**Single Impression Verification:**
- Gas cost: ~50,000 gas units
- Cost per impression: ~$0.01 (at 200 gwei)

**Batch Verification (100 impressions):**
- Gas cost: ~500,000 gas units
- Cost per impression: ~$0.001
- **10x efficiency gain**

### 7.2 Scalability Limits

| Parameter | Limit | Purpose |
|-----------|-------|---------|
| Max proofs per batch | 100 | Gas/DoS protection |
| Max Merkle path depth | 40 | Gas/DoS protection |
| Max content ID length | 64 bytes | Gas optimization |
| Max placements/zones | 32 each | Gas optimization |
| Token creation cooldown | 5 minutes | Spam prevention |

**Throughput:**
- Can process 1000+ impressions per minute (with batching)
- Supports millions of impressions per day
- Limited by Sui network throughput, not contract design

---

## 9. Comparison with Traditional Systems

### 8.1 Privacy Comparison

| Feature | Traditional Ads | DLUX System |
|---------|----------------|-------------|
| User Tracking | Cross-site cookies | No identity tracking |
| Profile Building | Detailed profiles | Aggregate only |
| Data Storage | Centralized databases | Encrypted + Merkle trees |
| Verification | Self-reported | Cryptographic proofs |
| GDPR Compliance | Complex opt-out | Privacy by design |

### 8.2 Trust Model Comparison

| Aspect | Traditional Ads | DLUX System |
|--------|----------------|-------------|
| Payment Trust | Platform controls | Smart contract enforced |
| Verification Trust | Platform reports | Cryptographic proofs |
| Revenue Distribution | Manual/opaque | Automated/transparent |
| Dispute Resolution | Platform arbitration | On-chain verification |

---

## 10. Governance System

### 10.1 On-Chain Governance

The DLUX platform implements an on-chain governance system that allows the community to vote on key platform parameters. All votable parameters are centralized in a single `GovernanceConfig` shared object, ensuring consistency and transparency.

#### 10.1.1 Votable Parameters

**Simple Parameters:**
- `pm_duration_ms`: How long prediction markets run after dApp posting (default: 3 days)
- `votable_posting_fee`: Non-storage portion of posting fee (default: 1 SUI)
- `proposal_duration_ms`: Voting window for governance proposals (default: 7 days)
- `quorum_pct`: Minimum voter turnout percentage (default: 51%)

**Split Parameters:**
- `pm_splits`: Revenue splits during PM period [foundation, gateway, creator, pm_pool] (default: [10, 9, 41, 40])
- `post_splits`: Revenue splits after PM success [foundation, gateway, creator, pm_pool] (default: [10, 9, 81, 0])

#### 10.1.2 Governance Process

1. **Proposal Creation**: Backend creates proposal with eligible voter Merkle root
2. **Off-Chain Voting**: Eligible voters sign votes (YES/NO)
3. **Merkle Tree Building**: Backend builds Merkle tree of votes
4. **Proposal Execution**: Admin submits Merkle proofs, contract verifies:
   - Quorum met: `total_votes >= (eligible_voter_count * quorum_pct) / 100`
   - YES majority: `yes_count > no_count`
   - Merkle proofs valid (sample verification)
5. **Parameter Update**: Config updated, events emitted

#### 10.1.3 Eligible Voters

Determined off-chain by backend:
- Top-half creators by revenue
- Equal number of top PM earners
- Merkle root of eligible addresses built off-chain

#### 10.1.4 Security Properties

- **Quorum Enforcement**: Prevents minority rule
- **Majority Rule**: YES must exceed NO
- **Merkle Verification**: Cryptographic proof of vote validity
- **Split Validation**: Revenue splits must sum to 100%
- **Single Source of Truth**: All parameters in one shared object

### 10.2 Creator Escrow Mechanism

The `CreatorPMEscrow` system ensures creators are incentivized to produce safe content:

- **During PM**: Creator's share (41% default) held in escrow
- **PM Passes**: Escrow released to creator (total 81%)
- **PM Fails**: Escrow forfeited to PM pool, ads disabled

This creates strong incentives for content quality while protecting users from unsafe content.

---

## 11. Future Enhancements

### 11.1 Planned Improvements

1. **Enhanced ZK Circuits**: More efficient proof generation
2. **Decentralized Aggregation**: Multiple aggregators for trust distribution
3. **Cross-Chain Support**: Extend to other blockchains
4. **Advanced Targeting**: Privacy-preserving targeting using secure multi-party computation
5. **Governance UI**: Frontend interface for proposal creation and voting

### 11.2 Research Directions

1. **Homomorphic Signatures**: Hide payment sender/recipient linkage
2. **Private Revenue Pools**: Encrypted pool balances
3. **Decentralized Walrus Nodes**: Trustless content serving
4. **ZK-Native Targeting**: Zero-knowledge user profile matching
5. **Automated Proposal Execution**: Trustless proposal execution without admin

---

## 12. Conclusion

The DLUX Move contract system provides a comprehensive solution for privacy-preserving, verifiable content monetization and revenue distribution. Unlike traditional ad networks, DLUX operates as a complete content flywheel where:

- **Content-as-Ads**: Any content that runs in the Walrus gateway can be promoted as an ad
- **Decentralized Moderation**: Prediction markets verify all content (including ads) before approval
- **PM-Aware Revenue**: Revenue distribution incentivizes truth-seeking through prediction markets
- **Governance-Controlled**: All revenue splits and key parameters are votable by the community
- **Creator Escrow**: Creator shares held in escrow during PM, released/forfeited based on PM outcome
- **Strong Privacy**: User identities never revealed in tracking or payment flows
- **Cryptographic Verifiability**: All impressions provably verified on-chain
- **Efficient Batching**: Cost-effective settlement through batch aggregation
- **Trustless Distribution**: Smart contract-enforced revenue sharing

By combining zero-knowledge proofs, Merkle tree batch verification, homomorphic encryption, anonymous tokens, decentralized prediction markets, and on-chain governance, the system achieves:

- **Complete Content Flywheel**: From posting → PM verification → ad campaigns → tracking → revenue distribution → storage funding
- **Incentive Alignment**: PM-active content routes revenue to PM pool (incentivizes safety reviews), PM-passed content routes revenue to creators (rewards safe content), PM-failed content disables ads (protects users)
- **Decentralized Infrastructure**: Walrus gateway serves content, PMs moderate content, Move contracts enforce rules
- **Community Governance**: Platform parameters adapt to ecosystem needs through on-chain voting

The architecture demonstrates that blockchain-based content monetization systems can provide privacy, verifiability, decentralized moderation, and community governance, addressing fundamental limitations of traditional platforms while maintaining scalability and cost efficiency. The Move contracts orchestrate the entire ecosystem, ensuring trustless verification, privacy-preserving tracking, incentive-aligned revenue distribution, and community-driven parameter management.

---

## Appendix A: Contract Addresses & Deployment

**Testnet Deployment:**
- Package ID: `0x...` (to be updated)
- Admin Cap: Owned by deployer
- Revenue Pool: Shared object, created on init
- Click Token Registry: Shared object, created on init

**Mainnet Deployment:**
- TBD (pending audit completion)

---

## Appendix B: Governance Specifications

### B.1 Governance Parameters

**Default Values:**
- `pm_duration_ms`: 259,200,000 (3 days)
- `votable_posting_fee`: 1,000,000,000 MIST (1 SUI)
- `proposal_duration_ms`: 604,800,000 (7 days)
- `quorum_pct`: 51

**PM-Period Revenue Splits (default):**
- Foundation: 10%
- Gateway: 9%
- Creator (escrow): 41%
- PM Pool: 40%

**Post-PM Revenue Splits (default):**
- Foundation: 10%
- Gateway: 9%
- Creator: 81%
- PM Pool: 0%

### B.2 Proposal Execution

**Requirements:**
- Quorum: `total_votes >= (eligible_voter_count * quorum_pct) / 100`
- Majority: `yes_count > no_count`
- Merkle verification: Sample of vote proofs verified on-chain
- Expiration: Proposal must be expired (`now >= expires_at_ms`)

**Vote Merkle Tree:**
- Leaf: `keccak256(voter_address || vote_direction)`
- Vote direction: 0 = NO, 1 = YES
- Root: Merkle root of all votes

---

## Appendix C: Cryptographic Specifications

### C.1 Hash Function
- **Algorithm**: Keccak-256 (SHA3-256)
- **Output**: 32 bytes
- **Usage**: Merkle trees, token hashes, content IDs

### C.2 Homomorphic Encryption
- **Scheme**: Paillier
- **Key Size**: 2048 bits
- **Properties**: Additive homomorphism

### C.3 Zero-Knowledge Proofs
- **Framework**: Circom
- **Proof System**: Groth16 (via snarkjs)
- **Public Inputs**: ad_id, content_id, block_header
- **Private Inputs**: user_identity

---

## References

1. Sui Documentation: https://docs.sui.io
2. Move Language Reference: https://move-language.github.io/move/
3. Circom Documentation: https://docs.circom.io
4. Paillier Cryptosystem: Paillier, P. (1999). Public-key cryptosystems based on composite degree residuosity classes.
5. Merkle Tree Verification: Merkle, R. C. (1988). A digital signature based on a conventional encryption function.

---

**Document Version**: 2.0  
**Last Updated**: February 2026  
**Authors**: DLUX Development Team  
**License**: Proprietary
