# DLUX-SUI Developer Guide

## 🚀 Quick Start for AI Agents

DLUX-SUI is a decentralized metaverse platform built on Sui blockchain. This guide provides AI agents with everything needed to build, deploy, and monetize dApps and premium content.

### Platform Overview

**Core Components:**
- **Frontend**: Vue.js SPA with wallet integration
- **Sandbox Service**: Secure dApp execution environment
- **SUI Service**: Blockchain operations and user management
- **DGraph Service**: Rich queries and social data
- **Walrus Service**: Decentralized storage + premium content
- **Dgraph Service**: Markets & governance (includes prediction markets)

**Key Features:**
- Gas-free social interactions
- Privacy-preserving ad verification with ZK proofs
- Premium content monetization with Seal encryption
- Prediction markets for content moderation
- Decentralized storage with Walrus

**Favicons & SEO:** The Vue app (`frontend/vue-app/`) ships with DLUX favicons (`public/favicon.ico`, `public/dlux-icon-192.png`) and full SEO meta tags in `index.html`: description, Open Graph, and Twitter Card tags. Replace these assets and/or meta for white-label deployments; see `VITE_BRAND_*` in [developer-quick-reference](./developer-quick-reference.md).

---

## 📋 Getting Started

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/dlux-sui/dlux-sui.git
cd dlux-sui

# Start all services
npm run docker:up

# Services will be available on:
# Frontend: http://localhost:3000
# Sandbox: http://localhost:3007
# SUI Service: http://localhost:3001
# DGraph: http://localhost:3003 (includes markets & governance)
# Walrus: http://localhost:3002
# ZK Service: http://localhost:3010
# MCP Service: http://localhost:3009
# Webhook Service: http://localhost:3011
```

### 2. AI Assistant Integration (MCP)

DLUX-SUI provides a Model Context Protocol (MCP) server for AI assistants to help with development and management:

```bash
# Start MCP service
cd services/mcp-service
npm install
npm run build
npm start
```

**MCP Tools Available:**
- `get_account_overview` - Account analytics and alerts
- `get_ad_performance` - Ad campaign insights
- `list_user_dapps` - dApp management
- `get_content_performance` - Premium content analytics
- `get_platform_stats` - Market intelligence

### 3. Create Your First dApp

```javascript
// 1. Create a simple HTML dApp
const dappHtml = `
<!DOCTYPE html>
<html>
<head><title>My dApp</title></head>
<body>
  <h1>Welcome to DLUX!</h1>
  <p>Connected wallet: <span id="wallet"></span></p>
  <button onclick="connectWallet()">Connect Wallet</button>

  <script>
    // DLUX wallet API is automatically injected
    async function connectWallet() {
      try {
        const address = await window.dluxWallet.connect();
        document.getElementById('wallet').textContent = address;
      } catch (error) {
        console.error('Wallet connection failed:', error);
      }
    }
  </script>
</body>
</html>`;

// 2. Upload to Walrus storage
const formData = new FormData();
formData.append('file', new Blob([dappHtml], { type: 'text/html' }), 'index.html');

const uploadResponse = await fetch('http://localhost:3002/blobs/upload', {
  method: 'POST',
  body: formData
});

const { blobId } = await uploadResponse.json();

// 3. Register dApp on Sui blockchain
const dappRegistration = await fetch('http://localhost:3001/dapps', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "My First dApp",
    description: "A simple DLUX dApp",
    owner: "0xyour_wallet_address",
    permlink: "my-first-dapp",
    blobIds: [blobId]
  })
});

// 4. Access your dApp at:
// https://my-first-dapp.walrus.dlux.io/@0xyour_wallet_address/my-first-dapp
```

---

## 🔑 Authentication & Wallets

### Login Options

- **SSO** (Single Sign-On): Email, phone, or social login (Google, Twitter, Discord)—no browser extension required. Embedded self-custodial wallets via human.tech. Appears in the connect modal when available.
- **Wallet extensions**: Slush, Sui Wallet, or any Sui Wallet Standard–compatible wallet.
- **ZK Account linking**: Link GitHub, Gmail, or Facebook for enhanced verification (see `POST /auth/zk-link`).

### Wallet Integration

DLUX automatically injects wallet functionality into all dApps:

```javascript
// Available wallet methods
const wallets = await window.dluxWallet.getWallets(); // List available wallets
const address = await window.dluxWallet.connect();    // Connect wallet
const signature = await window.dluxWallet.signMessage("Hello DLUX!"); // Sign message

// SuiNS name resolution
const profile = await fetch(`http://localhost:3001/suins/profile/0xyour_address`);
const { suinsName } = await profile.json();
```

### User Sessions

```javascript
// Check authentication status
const session = window.dluxSocial.getAuthSession();
if (session?.user) {
  console.log('Logged in as:', session.user.suiAddress);
}

// JWT cookie authentication for API calls
// All API endpoints accept x-dlux-auth header with JWT token
```

---

## 📱 dApp Development

### Sandbox Environment

dApps run in a secure sandbox with automatic PWA generation:

```javascript
// Access dApp context
const context = window.dluxSocial.getContext();
console.log('dApp ID:', context.dappId);
console.log('Author:', context.author);
console.log('Permlink:', context.permlink);

// Social features (gas-free)
await window.dluxSocial.createPost({
  content: "Hello DLUX!",
  dappId: context.dappId
});

const posts = await window.dluxSocial.listPosts({
  dappId: context.dappId,
  limit: 10
});
```

### Premium Content

Monetize your content with Seal encryption:

```javascript
// Create premium content
const result = await window.dluxPremium.createContent(file, {
  name: "Exclusive Video",
  description: "Premium content",
  price: 0.5, // SUI
  owner: userAddress,
  dappId: context.dappId
});

// Check access and purchase
const content = await window.dluxPremium.getContent(context.dappId, userAddress);
if (!content.hasAccess) {
  // Show paywall
  const purchase = await window.dluxPremium.purchaseContent(content.id, paymentTxId);
}

// Access purchased content
const blob = await window.dluxPremium.accessContent(content.id);
```

### Ad Integration

Display privacy-preserving ads:

```javascript
// Show ad (automatic cooldown management)
// Subscription is per-creator: subscribe to a profile → ad-free when viewing their dApps.
// Creator is auto-derived from dApp context; pass explicitly if needed.
const result = await window.dluxAds.showAd({
  type: 'slip', // 'gate', 'slip', or 'install'
  cooldownMs: 600000, // 10 minutes
  creator: '0x...' // optional: dApp owner SUI address for per-creator subscription check
});

if (result.shown) {
  // Ad was displayed, continue with content
  showPremiumContent();
}
```

---

## 🔌 API Reference

### SUI Service (Port 3001)

#### User Management
```http
GET /suins/profile/{address_or_name}    # Get user profile
POST /suins/register-intent             # Start SuiNS registration
PUT /suins/profile/{identifier}         # Update profile
GET /suins/availability/{name}          # Check name availability
```

#### dApp Management
```http
POST /dapps                            # Create dApp
GET /dapps/{id}                        # Get dApp details
GET /dapps/owner/{address}             # Get user's dApps
GET /dapps/lookup                      # Lookup dApp by author/permlink
POST /dapps/{id}/install/challenge      # Get install challenge
POST /dapps/{id}/install                # Record PWA install
```

#### Authentication
```http
POST /auth/challenge                   # Generate auth challenge
POST /auth/zk-login                    # Login with ZK proof
POST /auth/zk-link                     # Link external accounts
GET /auth/profile/{address}            # Get linked accounts
```

#### Billing & Payouts
```http
GET /billing/overview?owner={address}           # Complete billing overview
GET /billing/transactions?owner={address}       # Recent transaction digests (for explorer links)
POST /billing/claim                             # Claim SUI payouts
POST /billing/verify-payment                    # Verify regular payments (on-chain)
POST /billing/verify-premium-payment            # Verify premium content payments (on-chain)
```

### DGraph Service (Port 3003)

#### Personal data and JWT
Some DGraph routes return **personal data** (subscriptions, location preferences, campaigns by advertiser). Those routes only return full data when the request includes a valid **JWT** (same as issued by SUI service `/auth/zk-login` or challenge flow) and the JWT identity matches the **party to the record** (subscriber, user, advertiser).

- **Without JWT or wrong identity:** 403, or a minimal response (e.g. subscription status returns only `{ active: boolean }`).
- **With `Authorization: Bearer <token>` and matching identity:** full response.

Use the same `JWT_SECRET` in both SUI and DGraph services. The frontend should send the auth token when calling billing/overview (SUI service forwards it to DGraph for subscription) and when calling DGraph directly for subscription, location preferences, or “my campaigns.”

#### Social Data
```http
GET /social/users/{address}/stats      # User social stats
GET /social/posts                      # Query posts (with filters)
POST /social/posts                     # Create post
GET /social/interactions               # Get interactions
POST /social/interactions              # Create interaction
```

#### Ad Tracking
```http
POST /impressions                      # Record ad impression
GET /impressions/content/{contentId}   # Get impressions
GET /impressions/ad/{adId}             # Get ad impressions
POST /ads/clicks                       # Record ad click
POST /ads/conversions                  # Record conversion
GET /ads/revenue/{dappId}              # Get ad revenue
GET /ads/revenue/owner/{owner}         # Get owner ad revenue
```

#### Social Blockchain
```http
GET /blocks/latest                     # Get latest social block
GET /blocks/{blockId}                  # Get specific block
POST /ecosystem/register-peer          # Register as ecosystem peer
GET /ecosystem/peers                   # List active peers
```

### Walrus Service (Port 3002)

#### Blob Storage
```http
POST /blobs/upload                    # Upload file
GET /blobs/{blobId}                   # Download blob
GET /blobs/{blobId}/info              # Get blob metadata
GET /blobs/{blobId}/billing           # Get storage billing info
GET /blobs                            # List blobs
DELETE /blobs/{blobId}                # Delete blob
```

#### Premium Content
```http
POST /premium/content                 # Create premium content
GET /premium/content/{dappId}         # List premium content
POST /premium/purchase                 # Purchase content access
GET /premium/access/{contentId}       # Access purchased content
GET /premium/purchases/{user}         # Get user purchases
GET /premium/earnings/{owner}         # Get creator earnings
DELETE /premium/content/{contentId}   # Delete content
```

#### Ad Gateway
```http
GET /ads/click                        # Ad click-through
GET /ads/convert                      # Conversion tracking
POST /ads/consent                     # Set ad consent
```

### Dgraph Service (Port 3003) - Markets & Governance

#### Prediction Markets
```http
POST /markets                         # Create prediction market
GET /markets/dapp/{dappId}            # Get active dApp markets
GET /markets/dapp/{dappId}/resolved   # Get resolved dApp markets (bettor count, total pool)
POST /markets/{id}/bets               # Place bet
GET /markets/{id}/status              # Get market status
POST /markets/{id}/resolve            # Resolve market
GET /markets/high-payout              # High payout markets
GET /markets/fees/{dappId}            # Get PM fees for dApp
GET /markets/payouts/{owner}          # Get owner payouts
```

#### Governance (DGraph - discussion layer)
```http
GET /governance/variables             # Legacy governance variables
POST /governance/proposals            # Create discussion proposal
POST /governance/proposals/{id}/vote  # Cast discussion vote (off-chain)
```

#### Governance (SUI Service, Port 3001 - on-chain)
```http
GET /governance/config                # On-chain GovernanceConfig (PM duration, votable fee, revenue splits, quorum)
GET /governance/proposals             # On-chain proposals (from ProposalCreated events)
```

**Fee Formula**: `min_posting_fee = 2 × storage_cost + votable_posting_fee`
- `storage_cost`: from Walrus `/blobs/billing/batch`
- `votable_posting_fee`: from `GET /governance/config` (default: 1 SUI)

### ZK Service (Port 3010)

#### Proof Generation
```http
POST /proofs/generate                 # Generate ZK proof
POST /proofs/generate-click           # Generate click proof
POST /proofs/generate-conversion      # Generate conversion proof
POST /proofs/verify                   # Verify ZK proof
POST /proofs/aggregate                # Homomorphic aggregation
POST /proofs/decrypt-aggregate        # Decrypt aggregates (admin)
```

### Sandbox Service (Port 3007)

#### dApp Serving
```http
GET /{subdomain}.walrus.dlux.io/*     # Serve dApp content
GET /metadata                         # Get dApp metadata for bots
GET /manifest.json                    # PWA manifest
GET /sw.js                            # Service worker
GET /wallet-script.js                 # Wallet integration
GET /social-script.js                 # Social features
```

---

## 💰 Monetization Features

### Ad Revenue

```javascript
// Display ads in your dApp
const adResult = await window.dluxAds.showAd({
  type: 'gate',  // Show before content
  cooldownMs: 600000
});

// Privacy-preserving verification
// Ads use ZK proofs - no user identity revealed
```

**Revenue Sharing:**
- Creator: 50% of ad revenue
- Platform: 30%
- PM Pool: 10%
- Reserve: 10%

### Premium Content

```javascript
// Create paid content
const content = await window.dluxPremium.createContent(file, {
  name: "Premium Tutorial",
  price: 1.0, // SUI
  owner: creatorAddress,
  dappId: currentDappId
});

// Revenue distribution:
// Creator: 90% (after 10% platform fee)
// Platform: 10% (automatic)
```

### Prediction Markets

```javascript
// Create safety market for your dApp
const market = await fetch('http://localhost:3003/markets', {
  method: 'POST',
  body: JSON.stringify({
    dappId: yourDappId,
    safetyMetric: 'nsfw',
    description: 'Content safety review',
    postingFeeContribution: 0.1
  })
});

// Users bet on content safety
// Creators earn from PM fees
```

### Location & Digital Twin Features

**Location Metadata:**
```javascript
// Create location metadata for content
const location = {
  latitude: 40.6 * 1e6,   // NYC (scaled by 1e6)
  longitude: -74.0 * 1e6,
  elevation: 10,           // meters
  planet: 0                // 0=Earth, 1=Moon, 2=Mars
};
```

**Digital Twin Origins:**
```javascript
// 6DOF pose for virtual world positioning
const origin = {
  gltfIndex: "models/building.gltf",
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1.0 }  // Quaternion
};
```

**Ad Campaign Targeting:**
```javascript
// Create campaign with geo-targeting
const campaign = await createCampaign({
  // ... standard fields ...
  userZones: ["US", "EU"],        // GeoIP targeting
  contentZones: ["NYC", "LON"],   // Content location
  planet: 0                        // Earth (optional)
});
```

See [Location & Digital Twin Documentation](./contracts/location-digital-twin.md) for complete API reference.

---

## 🔧 Configuration

### Environment Variables

#### SUI Service
```bash
PORT=3001
SUI_NETWORK=testnet  # testnet, devnet, or mainnet
SUI_RPC_URL=https://fullnode.testnet.sui.io  # Auto-set based on SUI_NETWORK
SUI_FAUCET_URL=https://faucet.testnet.sui.io/gas  # For testnet/devnet
JWT_SECRET=your_secret_here
```

**Network Configuration:**
- **Testnet**: `SUI_RPC_URL=https://fullnode.testnet.sui.io`
- **Devnet**: `SUI_RPC_URL=https://fullnode.devnet.sui.io`
- **Mainnet**: `SUI_RPC_URL=https://fullnode.mainnet.sui.io`

#### Walrus Service
```bash
PORT=3002
WALRUS_BASE_URL=https://walrus-mainnet.mrgnlabs.xyz
PLATFORM_FEE_PERCENT=0.10
FOUNDATION_ADDRESS=0xfoundation_address
MODERATION_ADDRESSES=0xmod1,0xmod2
```

#### DGraph Service
```bash
PORT=3003
DGRAPH_HOST=localhost:9080
DGRAPH_USER=groot
DGRAPH_PASSWORD=password
ZK_SERVICE_URL=http://localhost:3010
FOUNDATION_ADDRESS=0xfoundation_address  # Subscription recipient (platform-wide ad-free)
AD_IMPRESSION_THRESHOLD=100
```

#### Dgraph Service (markets)
Markets and governance are served from Dgraph (port 3003).

### Docker Deployment

**Basic Setup:**
```bash
# Start all services (default: testnet)
cd infrastructure
docker-compose up -d
```

**Network-Specific Configuration:**
```bash
# Testnet (default)
docker-compose -f docker-compose.yml -f docker-compose.testnet.yml up -d

# Devnet
docker-compose -f docker-compose.yml -f docker-compose.devnet.yml up -d

# Mainnet (WARNING: Real SUI tokens!)
docker-compose -f docker-compose.yml -f docker-compose.mainnet.yml up -d
```

**Environment Variables:**
```yaml
# docker-compose.yml
services:
  sui-service:
    environment:
      - SUI_NETWORK=${SUI_NETWORK:-testnet}  # testnet, devnet, or mainnet
      - SUI_RPC_URL=${SUI_RPC_URL:-}  # Auto-set based on SUI_NETWORK if not provided
      - SUI_FAUCET_URL=${SUI_FAUCET_URL:-}  # For testnet/devnet
```

**Network RPC URLs:**
- **Testnet**: `https://fullnode.testnet.sui.io:443`
- **Devnet**: `https://fullnode.devnet.sui.io:443`
- **Mainnet**: `https://fullnode.mainnet.sui.io:443`

See `infrastructure/README.md` for complete Docker configuration and network setup.

---

## 📊 Analytics & Monitoring

### Revenue Tracking

```javascript
// Get complete billing overview
const billing = await fetch(`http://localhost:3001/billing/overview?owner=${userAddress}`);
const { payouts, storageFunding } = await billing.json();

// Individual revenue streams
console.log('Ad Share:', payouts.adShare);
console.log('Premium Content:', payouts.premiumShare);
console.log('PM Share:', payouts.pmShare);
```

### Storage Monitoring

```javascript
// Check storage funding status
const storage = await fetch(`http://localhost:3001/billing/storage/${dappId}/${blobId}`);
const { coveragePercent, termProgressPercent, precarious } = await storage.json();

if (precarious) {
  console.log('Storage at risk - add funds or auto-renewal will fail');
}
```

### Content Performance

```javascript
// Premium content analytics
const earnings = await fetch(`http://localhost:3002/premium/earnings/${creatorAddress}`);
const { total, breakdown } = await earnings.json();

breakdown.forEach(item => {
  console.log(`${item.contentName}: ${item.earnings} SUI (${item.purchases} sales)`);
});
```

---

## 🔒 Security Best Practices

### Content Safety
```javascript
// All dApps go through prediction markets
// Users bet on content safety before release
// Platform moderation has access to all content
```

### Payment Security
```javascript
// All payments verified on Sui blockchain
// Premium content uses Seal encryption
// Platform fee automatically distributed
```

### Privacy Protection
```javascript
// ZK proofs for ad verification (no identity revealed)
// Homomorphic encryption for analytics
// User consent required for tracking
```

---

## 🚀 Deployment Checklist

### Pre-Launch
- [ ] Set up Sui wallet with sufficient funds
- [ ] Configure environment variables
- [ ] Test dApp in sandbox environment
- [ ] Set up premium content (if applicable)
- [ ] Configure ad placements

### Launch Steps
1. **Register SuiNS name** (optional but recommended)
2. **Upload dApp to Walrus** storage
3. **Register dApp** on Sui blockchain
4. **Set up prediction market** for safety reviews
5. **Configure premium content** with pricing
6. **Test all features** in production environment

### Post-Launch
- Monitor revenue streams
- Engage with user community
- Update content regularly
- Optimize pricing based on analytics

---

## 🆘 Troubleshooting

### Common Issues

**dApp not loading:**
```bash
# Check blob upload
curl http://localhost:3002/blobs/{blobId}/info

# Verify dApp registration
curl http://localhost:3001/dapps/lookup?author={address}&permlink={permlink}
```

**Premium content access denied:**
```bash
# Check purchase status
curl http://localhost:3002/premium/purchases/{userAddress}

# Verify Seal access
curl http://localhost:3002/premium/content/{dappId}?user={userAddress}
```

**Payment verification failed:**
```bash
# Check transaction on Sui explorer
# Verify payment amount and recipient
# Ensure sufficient confirmations
```

---

## 📚 Additional Resources

- **Platform Overview**: `docs/index.md`
- **Premium Content**: `docs/premium-content.md`
- **Ad Network**: `docs/ad-network.md`
- **Architecture**: `docs/architecture-overview.md`

**Community & Support:**
- GitHub Issues for bug reports
- Discord for community discussions
- Documentation updates welcome via PR

---

*This guide is designed for AI agents to quickly understand and utilize the DLUX-SUI platform. All features and APIs are documented with practical examples for immediate implementation.*