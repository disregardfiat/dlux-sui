# DLUX-SUI Documentation

DLUX-SUI is a decentralized metaverse platform built on the SUI blockchain, enabling users to create, share, and interact with decentralized applications (dApps) and content.

## Platform Overview

DLUX-SUI provides a comprehensive ecosystem for:

See **[System Reference](./system-reference.md)** for the canonical ports/domains/URL formats.

### 🚀 For Developers
**New to DLUX?** Start with our comprehensive [Developer Guide](./developer-guide.md) - designed specifically for AI agents and developers to quickly build, deploy, and monetize on the platform.

**Quick Start:**
- Build your first dApp in minutes
- Integrate premium content monetization
- Set up privacy-preserving ads
- Deploy to decentralized storage

- **Decentralized Application Hosting**: Sandboxed dApp execution with automatic PWA generation
- **Social Interactions**: Gas-free social features using Dgraph for offchain data
- **Prediction Markets**: Community-driven safety reviews and moderation
- **SuiNS Names**: User-owned profile URLs and identity management
- **Governance Markets**: Decentralized platform parameter control with capital-weighted voting
- **Privacy-Preserving Ad Verification**: Zero-knowledge proofs + homomorphic analytics
- **Premium Content Monetization**: Seal-encrypted content with programmable access control
- **Location-Based Vector Search**: Privacy-preserving location discovery with anonymized zones (opt-in)

## Core Services

### Premium Content Monetization

DLUX-SUI enables content creators to monetize digital assets through a secure paywall system using Sui's Seal programmable encryption protocol. See [Premium Content Documentation](./premium-content.md) for implementation details.

### Data Layer & Governance

The platform uses a **write-to-SUI, read-from-Dgraph** architecture with **social blockchain ordering** for ecosystem federation. All financial operations happen on SUI blockchain, social interactions are ordered into blocks and broadcast via Walrus for cross-ecosystem replication.

**Key Features:**
- **Blockchain-First**: All financial writes (SuiNS names, dApp posting, PMs, governance) happen on SUI
- **Social Blockchain**: Non-financial interactions ordered into verifiable blocks
- **Ecosystem Federation**: Cross-platform data sharing with cryptographic proofs
- **Indexed Reads**: Dgraph transforms flat blockchain data into rich graph relationships
- **On-chain Governance**: Platform parameters stored in `GovernanceConfig` on SUI, updated via Merkle-proven proposals
- **Off-chain Voting + On-chain Execution**: Top creators and PM earners vote off-chain; backend executes with Merkle proofs
- **Configurable Parameters**: PM duration, posting fee, revenue splits, proposal duration, quorum all governable
- **Replication Support**: Built-in backup/export functionality for mirroring

**On-chain Governance Parameters** (from `GovernanceConfig` shared object):
- `pm_duration_ms`: Prediction market duration (default: 3 days)
- `votable_posting_fee`: Votable fee added on top of storage costs (default: 1 SUI)
- `pm_foundation_pct` / `pm_gateway_pct` / `pm_creator_pct` / `pm_pool_pct`: Revenue splits during PM (10/9/41/40)
- `post_foundation_pct` / `post_gateway_pct` / `post_creator_pct` / `post_pm_pct`: Revenue splits after PM success (10/9/81/0)
- `proposal_duration_ms`: How long governance voting lasts (default: 7 days)
- `quorum_pct`: Required voter turnout for proposals (default: 51%)

**Posting Fee (dApp publish):**
- **Minimum**: `2 × storage_cost + votable_posting_fee` (computed from blob sizes and governance config at submit)
- **Split**: 50% → Foundation, 50% → buys creator a YES vote in the prediction market (PM)

### User Experience

#### Getting Started
1. Connect SUI wallet (Slush, Sui Wallet, or any SuiNS-compatible wallet). If your wallet has multiple accounts, you will be asked to select which account to sign in with.
2. Register a SuiNS name (optional, recommended for cleaner URLs)
3. Link ZK accounts for enhanced verification
4. Post dApps with automatic safety reviews
5. Participate in governance markets

Wallet logins sign a challenge and store a JWT in a shared subdomain cookie so
DLUX microservices can verify authenticated requests.

Note: Ad tracking only begins after explicit privacy policy consent during login.

#### Account Management
- **SuiNS Names**: Primary name resolution via SuiNS
- **ZK Account Linking**: GitHub, Gmail, Facebook integration
- **Profile Management**: Bio, avatar, banner, website, location. Your avatar and SuiNS name appear on dApp cards (hub, search) and in Walrus link previews when your dApps are shared.
- **Social Links**: Structured links to external profiles
- **Profile Metadata**: JSON metadata for custom attributes
- **Social Stats**: Posts, interactions, followers tracking
- **Identity Systems**: Uses SuiNS names and SUI addresses for identity management

#### dApp Publishing
- **Sandbox Execution**: Isolated dApp environment with PWA support
- **HTML Required**: Web apps must include at least one `.html` or `.htm` file as the entry point (wallet/nav scripts are injected into HTML)
- **Folder Upload**: Select a folder to upload an entire app directory; relative paths (e.g. `src="js/app.js"`) are resolved via `manifest.pathMap`
- **Remix UI**: Include `remix.html` in your folder upload to enable the Remix button—a page where users can swap assets (e.g. video player HTML with a different media file) and post a new dApp. Remix button is hidden when no `remix.html` is present.
- **License**: Creative Commons selector (CC0, CC-BY, CC-BY-SA, etc.) when posting; recommended for remixable dApps to respect licensing.
- **Safety Reviews**: Prediction markets for content moderation. Markets auto-resolve after the governance-set duration (capital-weighted: safe vs unsafe pool). Ad-share weight is flat for the first half of the PM, then linear decay. Bet pricing is size-aware: large orders move the price. **Close flow (no user claims):** one transaction (close_market_with_final_ad_and_distribute) deposits final ad revenue from the ad pool into the PM, then resolves and sends all payouts (redemption + ad share) to participants and dust to the creator; gas is paid from the pool. When a PM resolves, the dApp detail page shows the outcome and total capital placed.
- **Posting Fee**: Min `2×storage + votable_posting_fee`; 50% to Foundation, 50% buys creator a YES vote in PM
- **Media Support**: Walrus blob storage for assets
- **Premium Content**: Monetize content with Seal encryption and paywalls
- **Category Organization**: Gaming, social, finance, etc.
- **Updating a dApp**: On a dApp’s detail page, the owner sees an **Edit dApp** button. It opens the same submission flow at `/post?edit=<dappId>` with the form pre-filled: name, description, permlink (fixed), category, tags, and the current **path → blob** list from `manifest.pathMap`. You can add new files, replace existing paths by uploading files with the same path, bump the version (e.g. 1.0.0 → 1.0.1), add an optional release note (stored in `manifest.metadata.releaseNote`), and submit. Submitting an update triggers a new prediction market when a posting fee is set, and the dApp record is updated in place (same URL).

#### Ad Verification & Privacy
- **ZK Ad Views**: Ad views are verified with zero-knowledge proofs (no viewer identity revealed)
- **Homomorphic Analytics**: Aggregate ad stats computed on encrypted data
- **Merkle Batch Proofs**: On-chain verification uses Merkle roots for privacy
- **Content Gating**: Ads can be shown before content with signed "Continue to Content". Ads appear only when the Walrus gateway serves dApp content (e.g. `*.walrus.dlux.io`); viewing the dApp detail page on dlux.io (e.g. `/dapps/{id}`) does not show ads.
- **Explicit Consent**: Ad tracking only after opt-in to privacy policy
- **Age Verification**: Session-based age confirmation dialogs for NSFW and age-restricted content

#### Discovery & Profiles
- **Hub Search**: Unified search for dApps, authors, and NFTs
- **Location-Based Vector Search**: Privacy-preserving location-based discovery with anonymized zones (opt-in)
- **Author Pages**: Profile and posts with dApps highlighted; users post from their own pages
- **NFT Discovery**: Pulls in Sui-owned NFTs for profile and hub views

#### Social Features
- **dApp-Store First**: Home page focuses on trending dApps; no global feed on home
- **Feed Page** (`/feed`): Dedicated feed with Recent, Popular, and For you
- **dApp Discussions**: Threads and reviews live on each dApp's detail page (product-review style); use "Discuss" on cards or the Discussions section on the dApp page
- **Account Pages**: Users post and manage content on their own profile pages (`/@name`)
- **Gas-Free Interactions**: All social data stored offchain
- **Signed Offchain Actions**: Likes, replies, follows are signed but not broadcast
- **Rich Content**: Posts, replies, quotes, reposts with media
- **Follow System**: User relationships and feed curation
- **Engagement Metrics**: Likes, dislikes, shares tracking

## API Reference

### Data Layer Endpoints

#### Dgraph Service (Port 3003)
- `POST /admin/export` - Export database for replication
- `POST /admin/backup` - Create database backup
- `GET /social/*` - Social interaction APIs
- `GET /graphql` - GraphQL endpoint for queries
- `POST /impressions` - Record ad impressions (ZK proofs)
- `GET /impressions/*` - Ad impression queries and Merkle roots
- `POST /installs/dapps/:dappId` - Record PWA installs (signature verified upstream)
- `POST /ads/clicks` - Record ad clicks (ZK proofs)
- `POST /ads/conversions` - Record ad conversions (ZK proofs)
- `POST /location/preferences` - Update user location search preferences (opt-in)
- `GET /location/preferences` - Get user location search preferences
- `POST /search/location` - Search content by location proximity (vector search)
- `GET /spots/popular` - List popular location spots for subscription
- `POST /spots/subscribe` - Subscribe to a popular location spot
- `DELETE /spots/subscribe/:spotId` - Unsubscribe from a location spot

#### Walrus Service (Port 3002)
- Blob storage for dApp assets (HTML/JS/WASM, media). By default blobs are in-memory and **lost on process restart**. Set **`WALRUS_DATA_DIR`** in `services/walrus-service/.env` (e.g. to `./data/walrus` or `/home/ubuntu/dlux-sui/data/walrus`) so blobs persist across deploys and restarts.
- `POST /blobs/billing/batch` - Compute total storage cost for a set of blob IDs (frontend/backend compute min fee as `2×storage + votable_posting_fee` from governance config)
- `POST /blobs/admin/cleanup-orphans` - Delete blobs not referenced by any dApp and older than 48h (remix-safe; requires `x-admin-key` if `ORPHAN_CLEANUP_ADMIN_KEY` is set)
- `GET /ads/click` - Ad click-through redirect (privacy-preserving)
- `GET /ads/convert` - Conversion tracking (privacy-preserving)
- `POST /ads/consent` - Explicit opt-in consent
- `POST /premium/content` - Create premium content (Seal-encrypted)
- `GET /premium/content/:dappId` - List premium content for dApp
- `POST /premium/purchase` - Purchase premium content access (10% platform fee)
- `GET /premium/access/:contentId` - Access purchased premium content
- `GET /premium/purchases/:user` - Get user's premium purchases
- `GET /premium/earnings/:owner` - Get premium content earnings for creator

#### ZK Service (Port 3010)
- `POST /proofs/generate` - Generate ZK ad view proof
- `POST /proofs/verify` - Verify ZK proof
- `POST /proofs/aggregate` - Homomorphic aggregation for impressions

#### MCP Service (Port 3009) - AI Assistant Integration
- `get_account_overview` - Complete account dashboard with alerts
- `GET /billing/transactions?owner=...` - Recent transaction digests (UI: “Recent transactions” with explorer links)
- `get_balance_breakdown` - Detailed payout breakdown
- `check_suins_status` - SuiNS name registration status
- `get_social_stats` - Social engagement metrics
- `get_ad_performance` - Ad campaign analytics
- `get_ad_recommendations` - AI-powered optimization suggestions
- `list_user_dapps` - Published dApps with insights
- `list_premium_content` - Premium content inventory
- `get_content_performance` - Content monetization analytics
- `get_platform_stats` - Overall platform metrics
- `get_trending_dapps` - Popular content discovery

#### SUI Service (Port 3001) - Write Operations
- `POST /suins/register-intent` - Get SuiNS registration URL (optional referral)
- `PUT /suins/profile/:identifier` - Update profile (returns transaction ID)
- `POST /dapps` - Publish dApp (returns transaction ID)
- `POST /dapps/:id/install/challenge` - Get install signing challenge
- `POST /dapps/:id/install` - Verify install signature + record install
- `POST /auth/zk-link` - Link ZK proof (returns transaction ID)
- `POST /billing/claim` - Claim payout balances to wallet
- `POST /billing/verify-premium-payment` - Verify premium content payments with fee distribution

#### SUI Service (Port 3001) - Governance
- `GET /governance/config` - Fetch on-chain `GovernanceConfig` parameters (PM duration, votable fee, revenue splits, proposal duration, quorum). Cached for 60s.
- `GET /governance/proposals` - Query on-chain `ProposalCreated` / `ProposalExecuted` events, returns proposals with status (active/expired/executed), param_key, proposer, expires_at.

#### Dgraph Service (Port 3003) - Markets & Governance
- `GET /markets/fees/:dappId` - Total fees for dApp
- `GET /markets/payouts/:owner` - Claimable PM payout plus aggregate stats (`total`, `marketsWon`, `marketsTotal`)
- `GET /markets/high-payout` - Markets by pool size
- `GET /markets/dapp/:dappId` - Active markets for dApp
- `GET /markets/dapp/:dappId/resolved` - Resolved markets with bettor count and total pool
- `GET /markets/dapp/:dappId/expired` - Expired but not yet resolved markets (pending auto-resolve)
- `POST /markets` - Create prediction market (returns transaction ID)
- `POST /markets/:id/bets` - Place prediction market bet (returns transaction ID)
- `GET /safety/dapp/:dappId` - Safety status for dApp
- `GET /governance/variables` - Legacy governance variables (prefer `GET /governance/config` on SUI Service)
- `POST /governance/proposals` - Create discussion proposal (community layer; on-chain execution is backend-driven)
- `POST /governance/proposals/:id/vote` - Cast discussion vote (off-chain; on-chain execution uses Merkle proofs)

#### SUI Service (Port 3001) - Read Operations
- `GET /suins/availability/:name` - Check SuiNS name availability
- `GET /suins/resolve/:name` - Resolve SuiNS name to address
- `GET /suins/reverse/:address` - Resolve address to SuiNS name
- `GET /suins/profile/:identifier` - Get profile by SuiNS name or address
- `GET /dapps/lookup?author={address}&permlink={permlink}` - Lookup dApp metadata for overlays

#### Dgraph Service (Port 3003) - Read Operations
- `GET /social/*` - Query social data and relationships
- `GET /graphql` - GraphQL queries for rich data relationships
- `POST /admin/export` - Export data for replication
- `POST /admin/backup` - Create database backup
- `GET /blocks/latest` - Get latest social block information
- `GET /blocks/:blockId` - Get and verify specific social block
- `GET /ecosystem/peers` - List active ecosystem peers
- `POST /ecosystem/register-peer` - Register as ecosystem peer

### URL Structure

- **Main Site**: `https://dlux.io`
- **User Profiles**: `https://dlux.io/@username` or `https://dlux.io/@sui_address`
- **dApps**: `https://{permlink}.walrus.dlux.io/@author/{permlink}`
- **API Docs**: See individual service documentation

## Development

### Local Setup
```bash
# Start all services
npm run docker:up

# Services available on:
# - Frontend (dev / Vite): http://localhost:3000
# - Frontend test (server): http://localhost:3006 (test.dlux.io); prod: http://localhost:3007 (dlux.io, updated via scripts/promote-test-to-prod.sh)
# - Dgraph: http://localhost:3003/graphql
# - SUI Service: http://localhost:3001
# - Walrus: http://localhost:3002
# - MCP Service: http://localhost:3009
# - ZK Service: http://localhost:3010
# - Webhook Service: http://localhost:3011
```

### Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Vue Frontend  │    │  Sandbox Service│
│   (Port 3000)   │    │   (Port 3007)   │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └─────────┬────────────┘
                    │
          ┌─────────▼────────────┐
          │    Dgraph Service    │ ◄─────────────────┐
          │     (Port 3003)      │                   │
          │                      │                   │
          │  - Indexes SUI data  │ ◄──┐              │
          │  - Rich queries      │    │              │
          │  - Social relationships│    │              │
          │  - Markets & safety   │────┼──► SUI       │
          │  - Governance        │────┘   Blockchain │
          └─────────┬────────────┘                   │
                    │                                │
          ┌─────────▼────────────┐                   │
          │                      │                   │
          │   SUI Service        │───────────────────┘
          │  (Port 3001)         │
          │                      │
          │  - SuiNS registration│
          │  - dApp posting      │
          │  - ZK linking        │
          └─────────┬────────────┘
                    │
          ┌─────────▼────────────┐
          │                      │
          │  Walrus Service      │
          │  (Port 3002)         │
          │                      │
          │  - Blob Storage      │
          └──────────────────────┘
```

**Data Flow:**
1. **Write Operations** → Services create SUI transactions
2. **SUI Confirmation** → Blockchain validates and records transactions
3. **Indexing** → Dgraph indexer monitors SUI and transforms data into rich graphs
4. **Read Operations** → Frontend queries indexed data from Dgraph

## Governance

Platform parameters are stored on-chain in a `GovernanceConfig` shared object, controlled by eligible top creators and PM earners through an off-chain voting + on-chain execution model.

### On-chain GovernanceConfig

All governable parameters live in a single shared object on SUI. The backend reads this object via `GET /governance/config` (SUI Service). Parameters include PM duration, votable posting fee, revenue split percentages during/after PM, proposal duration, and quorum percentage.

### Revenue Splits

**During PM** (dApp's prediction market is active):
| Recipient | Default % |
|-----------|-----------|
| Foundation | 10% |
| Gateway / Walrus | 9% |
| Creator (held in escrow) | 41% |
| PM Pool | 40% |

**After PM Success**:
| Recipient | Default % |
|-----------|-----------|
| Foundation | 10% |
| Gateway / Walrus | 9% |
| Creator | 81% |
| PM Pool | 0% |

**After PM Failure**: Ads are disabled. The 41% creator escrow is forfeited to the PM pool.

### Participating in Governance

1. **Discussion Proposals**: Eligible members create discussion proposals via the frontend (stored in DGraph).
2. **Off-chain Voting**: Community members vote; votes are recorded for discussion.
3. **Quorum Check**: When quorum is met and the voting period expires, the backend creates an on-chain `GovernanceProposal`.
4. **On-chain Execution**: The backend submits Merkle proofs of eligible voters and their votes to `execute_proposal`, which updates `GovernanceConfig` parameters.
5. **Immediate Effect**: Updated parameters take effect for all subsequent transactions.

## Social Blockchain & Ecosystem Federation

The platform implements a **social blockchain** for ordering and replicating social interactions across federated ecosystems. Social actions are grouped into blocks, cryptographically signed, and broadcast via Walrus for cross-platform synchronization.

### Social Blockchain Features

- **Ordered Interactions**: All social actions (posts, likes, follows) are globally ordered
- **Block Broadcasting**: Blocks are published to Walrus for ecosystem-wide replication
- **Cryptographic Proofs**: Each block includes signatures from ecosystem participants
- **Data Provenance**: Verifiable proof of data authenticity and ordering
- **Federated Mirroring**: Other DGraph instances can mirror and verify social data

### Ecosystem Federation

Participate in a decentralized network where platforms can:

1. **Mirror Social Graphs**: Import and verify social data from other ecosystems
2. **Cross-Platform Relationships**: Follow users and interact with content across platforms
3. **Shared Governance**: Participate in governance markets from federated platforms
4. **Verified Replication**: Cryptographically prove the authenticity of mirrored data

### Block Verification

```bash
# Verify block provenance
curl http://localhost:3003/blocks/block_123

# Get latest block info
curl http://localhost:3003/blocks/latest

# List ecosystem peers
curl http://localhost:3003/ecosystem/peers

# Register as ecosystem peer
curl -X POST http://localhost:3003/ecosystem/register-peer \
  -H "Content-Type: application/json" \
  -d '{"id": "my-platform", "name": "My Platform", "dgraphEndpoint": "https://myplatform.com/dgraph", "publicKey": "..."}'
```

### Data Flow Architecture

```
User Action → Social Interaction → Ordered in Block → Broadcast via Walrus → Ecosystem Replication
     ↓              ↓                    ↓                    ↓                    ↓
  Post/Like      Signed with Key       Block Finalized      Walrus Blob         Other Platforms
  Follow         Cryptographic         SHA-256 Hash         Decentralized       Verify & Mirror
  Comment        Authenticity          Peer Signatures      Storage             Social Graph Sync
```

### Current Governance Parameters

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `pm_duration_ms` | 259,200,000 (3 days) | Prediction market duration |
| `votable_posting_fee` | 1,000,000,000 (1 SUI) | Votable fee on top of 2x storage |
| `pm_foundation_pct` | 10% | Foundation share during PM |
| `pm_gateway_pct` | 9% | Gateway/Walrus share during PM |
| `pm_creator_pct` | 41% | Creator share during PM (escrowed) |
| `pm_pool_pct` | 40% | PM pool share during PM |
| `post_foundation_pct` | 10% | Foundation share after PM success |
| `post_gateway_pct` | 9% | Gateway share after PM success |
| `post_creator_pct` | 81% | Creator share after PM success |
| `post_pm_pct` | 0% | PM pool share after PM success |
| `proposal_duration_ms` | 604,800,000 (7 days) | Governance voting duration |
| `quorum_pct` | 51% | Required voter turnout |

## Identity & Verification

### Current Identity System

DLUX-SUI currently uses:
- **SuiNS Names**: Primary identity resolution via SuiNS (Sui Name Service)
- **SUI Addresses**: Wallet addresses as unique identifiers
- **ZK Account Linking**: Zero-knowledge proofs for linking external accounts (GitHub, Gmail, Facebook)

### Identity System

The platform uses SuiNS names and SUI addresses for identity management:
- **SuiNS Names**: Primary identity resolution via SuiNS (Sui Name Service)
- **SUI Addresses**: Wallet addresses as unique identifiers
- **ZK Account Linking**: Zero-knowledge proofs for linking external accounts (GitHub, Gmail, Facebook)

### Age Verification

The platform uses session-based age confirmation for NSFW and age-restricted content:
- Users confirm age in a modal dialog
- Confirmation stored in `sessionStorage` (per session)
- No persistent age verification across sessions

See [Moderation System](./moderation-system.md) for age verification implementation details.

## Safety & Moderation

All dApps undergo community-driven safety reviews through prediction markets. Users bet on whether content is safe or unsafe, with markets resolving based on majority capital stake.

### Safety Metrics
- `nsfw`: Not safe for work content
- `age-restricted`: Age-gated content (13+, 18+, 21+)
- `malware`: Malicious code detection
- `phishing`: Phishing attempts
- `scam`: Fraudulent content

## Deployment

### Production Setup
- Use Docker Compose for service orchestration
- Configure Dgraph clustering for high availability
- Set up Caddy reverse proxy with wildcard SSL
- Enable Dgraph backup/export for replication

### Monitoring
- Health checks available at `/:service/health`
- Structured logging with configurable levels
- Performance monitoring for all services

## Documentation Index

- **[Hero dApp (Explorer & Ethos)](./hero-dapp.md)** - Expo-style dlux showcase: platform ethos bullets and four example user journeys (XR hobbyist, indie creator, AI tinkerer, mirror operator)
- **[Developer Guide](./developer-guide.md)** - Complete AI-friendly guide for building on DLUX
- **[Premium Content](./premium-content.md)** - Monetize digital assets with Seal encryption
- **[Ad Network](./ad-network.md)** - Privacy-preserving advertising system
- **[Ad Network Journeys](./ad-network-journeys.md)** - Complete user journeys: ad creation, content creation, user interactions, click bundling, revenue redemption, and PM distribution
- **[PM User Journeys](./pm-user-journeys.md)** - Prediction market user journeys: entering markets (betting), monitoring bets, market resolution, and exiting (claiming payouts)
- **[Social dApp Journeys](./social-dapp-journeys.md)** - Social interaction journeys: reviews, comments, likes, dislikes, feedback, and engagement on dApps
- **[Location Vector Search](./location-vector-search.md)** - Privacy-preserving location-based discovery with anonymized zones
- **[Architecture Overview](./architecture-overview.md)** - Technical system design
- **[Webhook Messaging & Escrow](./webhook-messaging-escrow.md)** - User key registration, escrow-unlock messages, prorata release, dApp webhooks (design)
- **[Sandbox Service](./sandbox-service.md)** - dApp execution environment
- **[Execution Plan](./execution-plan.md)** - Development roadmap and milestones
- **[Testing Style](./testing-style.md)** - E2E conventions: Playwright-only, multiple user-agents, testnet, wait-for-callback, backend no-touch
- **[Testnet Deployment](./TESTNET_DEPLOYMENT.md)** - Deploy contracts to SUI testnet and run full E2E
- **[OpenClaw Hackathon (Calling All Agents)](./HACKATHON_OPENCLAW_AGENTS.md)** - Track 2 skill marketplace focus, four agent journeys, eligibility, and demo checklist
- **[Skill Marketplace & Agent Journeys](./skill-marketplace-agent-journeys.md)** - Find, read, rate, install skills; PM payouts to poster and reviewers; four agent journeys (build & post, review, install, earn)

## Service Documentation

- **SUI Service** - Blockchain operations and user management
- **DGraph Service** - Social data and rich queries
- **Walrus Service** - Decentralized storage and premium content
- **Dgraph Service** - Markets and governance (consolidated)
- **ZK Service** - Zero-knowledge proofs and encryption
- **Sandbox Service** - Secure dApp execution

## Contributing

See individual service READMEs for development setup and contribution guidelines.

## License

[License information]