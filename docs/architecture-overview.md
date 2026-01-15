# DLUX-SUI Architecture Overview

## System Architecture

DLUX-SUI is a decentralized metaverse platform built on the SUI blockchain, enabling users to create, share, and interact with decentralized applications (dApps) and content.

### Core Services

1. **SUI Service** (`services/sui-service/`)
   - Blockchain integration and indexing
   - dApp registration and management
   - Authentication and vanity address management
   - Text object storage

2. **Walrus Service** (`services/walrus-service/`)
   - Blob storage for dApps and media
   - File upload/download API
   - Content serving

3. **DGraph Service** (`services/dgraph-service/`)
   - GraphQL API for contextualized data
   - Search and discovery
   - Relationship mapping

4. **Presence Service** (`services/presence-service/`)
   - WebRTC signaling and TURN servers
   - Real-time communication
   - VR/AR support

5. **PM Service** (`services/pm-service/`)
   - Prediction markets for moderation
   - Safety reviews and flags
   - Market resolution

6. **Sandbox Service** (`frontend/sandbox/`)
   - Wildcard subdomain serving
   - dApp sandboxing
   - PWA manifest generation
   - Safety warnings and dialogs

7. **Vue Frontend** (`frontend/vue-app/`)
   - User interface
   - dApp discovery
   - Account management
   - dApp posting

8. **Ad Service** (`services/ad-service/`) (Planned)
   - Ad campaign management
   - Impression tracking and verification
   - Ad selection and auction mechanism
   - Analytics and reporting
   - Integration with PM service for ad quality markets

## Data Schemas

### User & Authentication

#### User
```typescript
interface User {
  suiAddress: string;              // SUI blockchain address
  vanityAddress?: string;           // Optional vanity address (3-20 chars, URL-safe)
  linkedZKPs: ZKLink[];            // Linked zero-knowledge proofs
  profile?: UserProfile;            // User profile information
  createdAt: Date;
  updatedAt: Date;
}
```

#### UserProfile
```typescript
interface UserProfile {
  displayName?: string;             // Display name
  bio?: string;                     // Biography
  avatar?: string;                  // Avatar image URL
  banner?: string;                  // Banner image URL
  website?: string;                 // Website URL
  location?: string;                // Location
  verified?: boolean;               // Verification status
}
```

#### VanityAddress
```typescript
interface VanityAddress {
  address: string;                  // Vanity address (3-20 chars)
  owner: string;                    // SUI address of owner
  price: number;                    // Price paid in SUI
  purchasedAt: Date;
  expiresAt?: Date;                 // Optional expiration
  verified: boolean;
}
```

#### ZKLink
```typescript
interface ZKLink {
  provider: ZKProvider;            // 'github' | 'gmail' | 'facebook'
  proof: string;                    // Hashed proof
  linkedAt: Date;
}
```

### dApp Schema

#### SUIdApp
```typescript
interface SUIdApp {
  id: string;                      // Unique dApp ID
  name: string;                    // dApp name
  description: string;             // Description
  owner: string;                   // SUI address of owner
  permlink: string;                // URL identifier (e.g., "mygame")
  version: string;                 // Version string
  manifest: DAppManifest;          // dApp manifest
  blobIds: string[];               // Walrus blob IDs
  tags: string[];                  // Tags for categorization
  createdAt: Date;
  updatedAt: Date;
}
```

#### DAppManifest
```typescript
interface DAppManifest {
  entryPoint: string;              // Main entry point (e.g., "/index.html")
  assets: string[];                // Asset URLs
  dependencies: string[];           // Dependency URLs
  permissions: DAppPermission[];   // Required permissions
  metadata: {
    title: string;
    description: string;
    author: string;
    version: string;
    license?: string;
    thumbnail?: string;
    icon?: string;                 // App icon URL
    videoUrl?: string;             // Video content URL
    audioUrl?: string;             // Audio content URL
    streamUrl?: string;            // Livestream URL
    streamType?: string;           // Stream type (rtmp/hls/webrtc)
  };
}
```

#### DAppCategory
```typescript
type DAppCategory =
  | 'gaming'
  | 'social'
  | 'finance'
  | 'art'
  | 'music'
  | 'video'
  | 'podcast'
  | 'livestream'
  | 'utility'
  | 'other';
```

#### DAppPermission
```typescript
type DAppPermission =
  | 'wallet:read'
  | 'wallet:sign'
  | 'storage:read'
  | 'storage:write'
  | 'presence:read'
  | 'presence:write'
  | 'network:fetch'
  | 'camera'
  | 'microphone'
  | 'geolocation';
```

### Moderation Schema

#### PredictionMarket
```typescript
interface PredictionMarket {
  id: string;                      // Market ID
  dappId: string;                  // Associated dApp ID
  safetyMetric: SafetyMetric;      // Type of safety metric
  description: string;             // Market description
  recommendedAge?: AgeRating;      // Age rating if applicable
  
  // Market state
  status: 'open' | 'resolved' | 'cancelled';
  resolution: 'safe' | 'unsafe' | null;
  
  // Financial
  totalPool: number;               // Total SUI in market
  safePool: number;                // SUI bet on "safe"
  unsafePool: number;              // SUI bet on "unsafe"
  postingFeeContribution: number;  // 50% of posting fee
  
  // Timing
  createdAt: Date;
  expiresAt: Date;                 // 3 days from creation
  resolvedAt: Date | null;
  
  // Participants
  bets: PredictionBet[];
  
  // Metadata
  triggeredBy: 'posting' | 'file-change' | 'flag';
  triggeredByAddress: string;     // SUI address that triggered
}
```

#### SafetyMetric
```typescript
type SafetyMetric =
  | 'nsfw'
  | 'pen-test'
  | 'gdpr-compliance'
  | 'cookie-banner'
  | 'malware'
  | 'phishing'
  | 'scam'
  | 'age-restricted'
  | 'other';
```

#### AgeRating
```typescript
type AgeRating = 'none' | '13+' | '17+' | '18+' | '21+';
```

#### DAppSafetyStatus
```typescript
interface DAppSafetyStatus {
  dappId: string;
  permlink: string;
  author: string;
  
  // Active markets
  activeMarkets: PredictionMarket[];
  
  // Overall status
  overallStatus: 'safe' | 'warning' | 'unsafe' | 'unknown';
  overallColor: 'green' | 'yellow' | 'red' | 'gray';
  
  // Resolved markets
  resolvedMarkets: PredictionMarket[];
  
  // Flags
  flags: SafetyFlag[];
  
  // Last updated
  lastChecked: Date;
}
```

### PWA Schema

#### WebAppManifest
```typescript
interface WebAppManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui';
  background_color: string;
  theme_color: string;
  orientation: 'any' | 'portrait' | 'landscape';
  scope: string;
  icons: ManifestIcon[];
}
```

### Presence Schema

#### PresenceSession
```typescript
interface PresenceSession {
  id: string;
  userId: string;
  suiAddress: string;
  status: 'online' | 'away' | 'offline';
  location?: {
    dappId?: string;
    coordinates?: [number, number, number];
  };
  metadata: Record<string, any>;
  lastSeen: Date;
}
```

### Social Schema

#### SocialPost
```typescript
interface SocialPost {
  id: string;                      // Unique post ID
  author: string;                  // SUI address of author
  vanityAddress?: string;          // Optional vanity address
  content: string;                 // Post content (markdown supported)
  contentType: 'text' | 'markdown' | 'html';
  
  // References
  dappId?: string;                 // Optional dApp reference
  parentId?: string;               // For replies
  quoteId?: string;                // For quotes
  repostId?: string;               // For reposts
  
  // Media
  mediaUrls?: string[];            // Media attachments (Walrus blob IDs)
  
  // Engagement
  likes: number;
  dislikes: number;
  replies: number;
  reposts: number;
  quotes: number;
  
  // Metadata
  tags?: string[];                 // Hashtags
  mentions?: string[];             // Mentioned users
  
  // Signature (signed but NOT broadcast to SUI)
  signature: string;
  signedAt: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;                // Soft delete
}
```

#### SocialInteraction
```typescript
interface SocialInteraction {
  id: string;
  type: 'like' | 'dislike' | 'repost' | 'quote' | 'reply';
  user: string;                    // SUI address
  targetId: string;                // Post ID being interacted with
  targetType: 'post' | 'dapp' | 'profile';
  signature: string;               // Signed but NOT broadcast to SUI
  signedAt: Date;
  createdAt: Date;
  deletedAt?: Date;                // For undo actions
}
```

#### UserSocialStats
```typescript
interface UserSocialStats {
  suiAddress: string;
  vanityAddress?: string;
  posts: number;
  replies: number;
  likes: number;
  reposts: number;
  quotes: number;
  followers: number;
  following: number;
}
```

## URL Structure

### Account URLs
- **Vanity**: `https://dlux.io/@yourname`
- **SUI Address**: `https://dlux.io/@0xabc123...`

### dApp URLs
- **Format**: `https://{vanity}.walrus.dlux.io/{permlink}`
- **Example**: `https://alice.walrus.dlux.io/my-game`
- **Without vanity**: `https://0x12345678.walrus.dlux.io/my-game`

## Customer Journeys

### Journey 1: New User Registration

1. **Connect Wallet**
   - User visits DLUX-SUI
   - Clicks "Connect Wallet"
   - Connects SUI wallet (e.g., Sui Wallet extension)
   - System generates authentication challenge
   - User signs challenge with wallet
   - System creates user account with SUI address

2. **Optional: Purchase Vanity Address**
   - User navigates to account page (`/@{suiAddress}`)
   - Clicks "Get Vanity Address"
   - Enters desired vanity address (3-20 chars)
   - System checks availability and calculates price
   - User confirms purchase
   - System processes payment on SUI blockchain
   - Vanity address is registered
   - User can now use `@yourname` URLs

3. **Optional: Link ZK Accounts**
   - User goes to account settings
   - Selects provider (GitHub, Gmail, Facebook)
   - System generates challenge
   - User authenticates with provider
   - System verifies ZK proof
   - Account is linked

### Journey 2: Posting a dApp

1. **Navigate to Post Page**
   - User clicks "Post dApp" (requires authentication)
   - System redirects to `/post` if not authenticated

2. **Fill Basic Information**
   - Enter title (required)
   - System auto-generates permlink (can customize)
   - Enter description (required)
   - Select category
   - Add tags
   - Set version

3. **Upload Content**
   - Select content type:
     - **Web App**: Upload HTML/JS/WASM files
     - **Video**: Upload video file or provide URL
     - **Audio**: Upload audio file or provide URL
     - **Livestream**: Provide stream URL
     - **Mixed**: Upload multiple file types
   - Files are uploaded to Walrus service
   - System stores blob IDs

4. **Add Metadata**
   - Upload app icon (optional)
   - Upload thumbnail (optional)
   - Add additional JSON metadata (optional)

5. **Set Posting Fee**
   - Default: 10 SUI
   - Can customize (minimum 1 SUI)
   - 50% goes to prediction market for safety review

6. **Submit**
   - System validates all required fields
   - Uploads files to Walrus
   - Creates dApp record in SUI service
   - Creates prediction market (if posting fee > 0)
   - Redirects to user's account page
   - dApp is now accessible at `{vanity}.walrus.dlux.io/{permlink}`

### Journey 3: Discovering and Viewing dApps

1. **Browse dApps**
   - User visits homepage or `/dapps`
   - Views featured dApps
   - Can search by query, category, or tags
   - Can filter and sort results

2. **View dApp Details**
   - Click on dApp card
   - View description, tags, version
   - See owner information
   - View safety status (if markets exist)
   - Click to open dApp

3. **Access dApp**
   - System navigates to `{vanity}.walrus.dlux.io/{permlink}`
   - Sandbox service loads dApp
   - Checks for active prediction markets
   - If NSFW/age-restricted: Shows age confirmation dialog
   - If GDPR/cookie-banner: Shows cookie banner
   - If active markets: Shows safety warning banner
   - Injects wallet and navigation scripts
   - Serves dApp content from Walrus

### Journey 4: Safety Review Process

1. **Market Creation**
   - When dApp is posted, prediction market is created
   - 50% of posting fee goes to market pool
   - Market expires in 3 days
   - Initial status: "open"

2. **Betting Phase**
   - Users can bet on "safe" or "unsafe"
   - Bets are placed in SUI
   - Market odds update based on bets
   - Status color: green (safe), yellow (uncertain), red (unsafe)

3. **Market Resolution**
   - After 3 days, market resolves
   - Resolution based 100% on market bets (majority wins)
   - Winners receive payouts
   - Market status: "resolved"

4. **New Markets**
   - New market can be created if:
     - File changes (new version posted)
     - Someone flags suspicious content
   - Process repeats

### Journey 5: Account Management

1. **View Profile**
   - Navigate to `/@{vanity}` or `/@{suiAddress}`
   - View profile information:
     - Display name, bio, avatar, banner
     - Linked accounts (ZK proofs)
     - Published dApps
     - Active safety reviews
     - Social stats (posts, followers, following)

2. **Edit Profile**
   - Click "Edit Profile" (only for own account)
   - Update display name, bio, avatar, banner
   - Add website and location
   - Sign profile update (not broadcast to SUI)
   - Submit to DGraph service
   - Profile updates immediately

3. **View dApps**
   - See all published dApps in grid
   - Click dApp to navigate to it
   - View version, tags, last updated

4. **View Safety Reviews**
   - See all prediction markets for user's dApps
   - View market status (green/yellow/red)
   - See pool size, number of bets, days remaining

### Journey 6: Social Interactions

1. **Create a Post**
   - User navigates to feed or dApp page
   - Clicks "Post" or "Reply"
   - Enters content (supports markdown)
   - Optionally attaches media (uploads to Walrus)
   - Optionally tags dApp or mentions users
   - Signs message with SUI wallet (NOT broadcast to blockchain)
   - Submits to DGraph service
   - Post appears in feed immediately

2. **Interact with Content**
   - User views a post or dApp
   - Can like, dislike, repost, or quote
   - Signs interaction (NOT broadcast to SUI)
   - Submits to DGraph service
   - Engagement counts update immediately
   - Can undo by deleting interaction

3. **Reply to Post**
   - User clicks "Reply" on a post
   - Creates new post with `parentId` set
   - Signs and submits to DGraph
   - Reply appears threaded under original post
   - Parent post reply count increments

4. **Quote Post**
   - User clicks "Quote" on a post
   - Creates new post with `quoteId` set
   - Adds own commentary
   - Signs and submits to DGraph
   - Original post quote count increments

5. **Repost**
   - User clicks "Repost" on a post
   - Creates new post with `repostId` set
   - No content needed (just repost)
   - Signs and submits to DGraph
   - Original post repost count increments

6. **Follow Users**
   - User views another user's profile
   - Clicks "Follow"
   - Signs follow action (NOT broadcast to SUI)
   - Submits to DGraph service
   - Follow relationship created
   - User's posts appear in follower's feed

### Data Storage Strategy

**SUI Blockchain** (broadcast transactions):
- Prediction market creation
- dApp metadata registration
- Account linking (ZK proofs)
- Vanity address purchases
- Key management

**DGraph** (signed but not broadcast):
- Social posts
- Replies, likes, dislikes
- Quotes and reposts
- Profile updates
- Follow relationships
- Social engagement metrics

This separation allows:
- Fast, free social interactions (no gas fees)
- Rich social features without blockchain bloat
- Real-time updates and feeds
- Complex queries and filtering
- Heavy blockchain operations only when needed

## API Endpoints

### SUI Service (`http://localhost:3001`)

#### Authentication
- `POST /auth/challenge` - Generate authentication challenge
- `POST /auth/zk-login` - ZK login with SUI signature
- `POST /auth/zk-link` - Link ZK proof from external provider
- `GET /auth/profile/:suiAddress` - Get user profile

#### Vanity Addresses
- `GET /vanity/check/:vanity` - Check if vanity address is available
- `GET /vanity/:identifier` - Get user by vanity or SUI address
- `POST /vanity/purchase` - Purchase vanity address
- `PUT /vanity/:vanity/profile` - Update profile

#### dApps
- `GET /dapps` - List all dApps (paginated)
- `GET /dapps/:id` - Get dApp by ID
- `GET /dapps/owner/:suiAddress` - Get dApps by owner
- `GET /dapps/search` - Search dApps
- `POST /dapps` - Create dApp

### Walrus Service (`http://localhost:3002`)

#### Blobs
- `POST /blobs/upload` - Upload single file
- `POST /blobs/upload/multiple` - Upload multiple files
- `GET /blobs/:blobId` - Download blob
- `GET /blobs/:blobId/info` - Get blob metadata
- `GET /blobs` - List blobs (paginated)
- `DELETE /blobs/:blobId` - Delete blob metadata

### PM Service (`http://localhost:3008`)

#### Markets
- `POST /markets` - Create prediction market
- `GET /markets/:marketId` - Get market details
- `POST /markets/:marketId/bet` - Place bet
- `POST /markets/:marketId/resolve` - Resolve market

#### Safety
- `GET /safety/dapp/:dappId` - Get dApp safety status
- `POST /safety/flag` - Flag dApp for review

### Sandbox Service (`http://localhost:3007`)

- `GET /health` - Health check
- `GET /metadata` - Generate OpenGraph metadata
- `GET /manifest.json` - Generate Web App Manifest
- `GET /sw.js` - Generate Service Worker
- `GET /wallet-script.js` - Wallet injection script
- `GET /nav-script.js` - Navigation injection script
- `GET /*` - Serve dApp content

### Ad Service (`http://localhost:3009`) (Planned)

#### Campaigns
- `POST /campaigns` - Create ad campaign
- `GET /campaigns` - List campaigns (with filters)
- `GET /campaigns/:id` - Get campaign details
- `PUT /campaigns/:id` - Update campaign
- `POST /campaigns/:id/pause` - Pause campaign
- `POST /campaigns/:id/resume` - Resume campaign

#### Ads
- `GET /ads/active` - Get active ads for placement
- `POST /ads/select` - Select ad via auction

#### Impressions
- `POST /impressions` - Create impression
- `POST /impressions/:id/verify` - Verify impression
- `POST /impressions/:id/click` - Record click
- `GET /impressions` - List impressions (with filters)

#### Analytics
- `GET /analytics/campaign/:id` - Get campaign analytics
- `GET /analytics/advertiser/:address` - Get advertiser analytics

## Environment Variables

### SUI Service
- `PORT` - Service port (default: 3001)
- `SUI_NETWORK` - SUI network (testnet/mainnet)
- `PM_SERVICE_URL` - PM service URL (default: http://localhost:3008)
- `JWT_SECRET` - JWT secret for tokens

### Walrus Service
- `PORT` - Service port (default: 3002)
- `WALRUS_BASE_URL` - Walrus network URL

### PM Service
- `PORT` - Service port (default: 3008)
- `SUI_SERVICE_URL` - SUI service URL

### Sandbox Service
- `PORT` - Service port (default: 3007)
- `SUI_SERVICE_URL` - SUI service URL
- `GRAPHQL_SERVICE_URL` - GraphQL service URL
- `WALRUS_SERVICE_URL` - Walrus service URL
- `PM_SERVICE_URL` - PM service URL

### Ad Service (Planned)
- `PORT` - Service port (default: 3009)
- `SUI_SERVICE_URL` - SUI service URL
- `GRAPHQL_SERVICE_URL` - GraphQL service URL
- `PM_SERVICE_URL` - PM service URL
- `WALRUS_SERVICE_URL` - Walrus service URL

## Deployment

### Caddy Configuration

The system uses Caddy as a reverse proxy with wildcard SSL certificates:

```
*.walrus.dlux.io {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    @metadata {
        header User-Agent /bot|crawl|spider|slurp|google|bing|yandex/i
        method HEAD
        path_regexp ^(?:/([a-zA-Z]{3,}))?/@([^/]+)/([^/]+)$
    }
    handle @metadata {
        rewrite * /metadata?author={re.2}&permlink={re.3}&tag={re.1}
        reverse_proxy localhost:3007
    }
    handle {
        reverse_proxy localhost:3007
    }
}
```

### Service Endpoints

- `tincan.dlux.io` → `localhost:3004` and `localhost:3005` (Presence)
- `sui.dlux.io` → `localhost:3001` (SUI Service)
- `gql.dlux.io` → `localhost:3003` (GraphQL/DGraph)
- `walrus.dlux.io` → `localhost:3002` (Walrus Service)
- `test.dlux.io` → `localhost:3006` (Vue Frontend)
- `*.walrus.dlux.io` → `localhost:3007` (Sandbox Service)
- `ads.dlux.io` → `localhost:3009` (Ad Service - Planned)

## Ad Network Architecture

### Overview

The ad network enables content creators to promote their posts and dApps, generating revenue for the platform while improving content discovery. Ads are treated as first-class content (posts and dApps) and are integrated seamlessly into the platform's discovery mechanisms.

### Key Features

1. **Content Promotion**: Any post or dApp can be promoted as an ad
2. **Pre-dApp Display**: Ads shown before users open dApps
3. **Algorithmic Feed Integration**: Ads intermixed in algorithmic feeds
4. **Ad Verification**: Two verification methods for ad engagement
5. **Community Feedback**: Ads trigger prediction markets for community moderation
6. **Revenue Sharing**: Ad revenue supports platform improvements and content creators

### Ad Schema

#### AdCampaign
```typescript
interface AdCampaign {
  id: string;                      // Unique campaign ID
  advertiser: string;              // SUI address of advertiser
  vanityAddress?: string;          // Optional vanity address
  
  // Content reference
  contentType: 'post' | 'dapp';   // Type of content being promoted
  contentId: string;               // ID of post or dApp being promoted
  postId?: string;                 // If promoting a post
  dappId?: string;                 // If promoting a dApp
  
  // Campaign settings
  budget: number;                  // Total budget in SUI
  spent: number;                   // Amount spent so far
  dailyBudget?: number;            // Optional daily budget limit
  maxBid: number;                  // Maximum bid per impression/view
  targetAudience?: AudienceTarget; // Optional targeting criteria
  
  // Display settings
  placement: AdPlacement[];        // Where ads should appear
  startDate: Date;                 // Campaign start date
  endDate?: Date;                  // Optional end date
  
  // Status
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  
  // Verification method
  verificationMethod: 'cookie' | 'checksum';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

#### AdPlacement
```typescript
type AdPlacement =
  | 'pre-dapp'           // Before opening dApps
  | 'feed-algorithmic'   // In algorithmic feeds
  | 'feed-trending'      // In trending feeds
  | 'feed-category'      // In category-specific feeds
  | 'sidebar'            // Sidebar placement (future)
  | 'banner'             // Banner placement (future);
```

#### AudienceTarget
```typescript
interface AudienceTarget {
  categories?: string[];           // Target specific dApp categories
  tags?: string[];                 // Target specific tags
  minFollowers?: number;           // Minimum follower count
  interests?: string[];            // User interests
  excludeCategories?: string[];   // Exclude categories
}
```

#### AdImpression
```typescript
interface AdImpression {
  id: string;                      // Unique impression ID
  campaignId: string;              // Associated campaign
  userId?: string;                 // User who saw ad (if authenticated)
  sessionId: string;               // Session identifier
  
  // Context
  placement: AdPlacement;          // Where ad was shown
  contentType: 'post' | 'dapp';   // Type of promoted content
  contentId: string;               // Promoted content ID
  
  // Verification
  verificationMethod: 'cookie' | 'checksum';
  cookieValue?: string;            // Cookie value if cookie method
  checksum?: string;               // Content checksum if checksum method
  verified: boolean;               // Whether impression was verified
  verifiedAt?: Date;               // When verification occurred
  
  // Engagement
  clicked: boolean;                 // Whether user clicked
  clickedAt?: Date;                // When clicked
  converted: boolean;              // Whether user engaged with content
  convertedAt?: Date;              // When conversion occurred
  
  // Financial
  cost: number;                    // Cost in SUI for this impression
  bid: number;                     // Winning bid amount
  
  // Timestamps
  createdAt: Date;
}
```

#### AdVerification
```typescript
interface AdVerification {
  id: string;                      // Unique verification ID
  impressionId: string;            // Associated impression
  campaignId: string;              // Associated campaign
  
  // Verification method
  method: 'cookie' | 'checksum';
  
  // Cookie method
  cookieName?: string;             // Cookie name (e.g., "dlux-paid-login")
  cookieValue?: string;             // Cookie value
  cookieDomain?: string;            // Cookie domain
  
  // Checksum method
  contentChecksum?: string;         // SHA-256 checksum of downloaded content
  countdownStarted?: Date;          // When countdown started
  countdownDuration?: number;       // Countdown duration in seconds
  countdownExpires?: Date;          // When countdown expires
  
  // Status
  status: 'pending' | 'verified' | 'expired' | 'failed';
  verifiedAt?: Date;
  
  // Metadata
  createdAt: Date;
}
```

### Ad Display Logic

#### Pre-dApp Display

When a user attempts to open a dApp:

1. **Check for Active Ads**
   - Query ad service for active campaigns targeting `pre-dapp` placement
   - Filter by targeting criteria (if any)
   - Select ad using auction mechanism (highest bid wins)

2. **Display Ad**
   - Show ad content (post or dApp preview) in modal/overlay
   - Mark ad as "shown" and create impression record
   - Start verification process based on campaign's verification method

3. **User Interaction**
   - User can click to view full content
   - User can dismiss ad
   - User proceeds to dApp after interaction

#### Algorithmic Feed Integration

Ads are intermixed in algorithmic feeds using a weighted algorithm:

1. **Feed Generation**
   - Generate base feed using existing algorithm (trending, following, etc.)
   - Query for active ads targeting `feed-algorithmic` placement
   - Calculate ad insertion points based on:
     - Ad bid amount
     - User targeting match score
     - Content relevance
     - Ad frequency caps

2. **Ad Insertion**
   - Insert ads at calculated positions (e.g., every 5-10 posts)
   - Mark ads clearly as "Promoted" or "Sponsored"
   - Maintain natural feed flow

3. **Verification**
   - Track impressions as user scrolls past ad
   - Start verification based on campaign method
   - Record engagement (clicks, views, etc.)

### Ad Verification Methods

#### Method 1: Cookie-Based Verification

For dApp ads, the sandbox service can set a site-wide cookie indicating paid login status:

1. **Cookie Setup**
   - When ad is displayed, sandbox service sets cookie: `dlux-paid-login={campaignId}:{timestamp}`
   - Cookie is set for domain: `.walrus.dlux.io` (site-wide)
   - Cookie includes campaign ID and timestamp

2. **Verification**
   - dApp wrapper checks for cookie on load
   - If cookie exists and is valid, reports back to ad service
   - Ad service verifies cookie and marks impression as verified
   - Cookie expires after countdown period or session end

3. **Benefits**
   - Simple implementation
   - Works across all dApps in sandbox
   - No content modification needed

#### Method 2: Checksum-Based Verification

For more granular verification, dApp wrapper reports content checksum:

1. **Checksum Generation**
   - When ad content (dApp) is downloaded, calculate SHA-256 checksum
   - Store checksum in ad verification record
   - Start countdown timer (e.g., 30 seconds)

2. **Verification**
   - dApp wrapper reports checksum back to ad service
   - Ad service verifies checksum matches expected value
   - If match and countdown hasn't expired, mark as verified
   - Countdown ensures user actually downloaded/viewed content

3. **Benefits**
   - More accurate verification
   - Prevents cookie-based bypass
   - Works for both posts and dApps

### Integration Points

#### Sandbox Service

The sandbox service handles ad display before dApp loading:

```typescript
// In sandbox service (frontend/sandbox/index.js)
async function serveDApp(req, res) {
  // 1. Check for active pre-dapp ads
  const ads = await adService.getActiveAds({
    placement: 'pre-dapp',
    targetAudience: getUserProfile(req.user)
  });
  
  if (ads.length > 0) {
    const selectedAd = await adService.selectAd(ads); // Auction
    const impression = await adService.createImpression({
      campaignId: selectedAd.id,
      placement: 'pre-dapp',
      verificationMethod: selectedAd.verificationMethod
    });
    
    // 2. Display ad overlay
    return renderAdOverlay(selectedAd, impression);
  }
  
  // 3. Proceed to dApp if no ads or after ad interaction
  return serveDAppContent(req, res);
}
```

#### DGraph Service

The DGraph service handles ad insertion in feeds:

```typescript
// In dgraph-service feed generation
async function generateFeed(userId: string, feedType: string) {
  // 1. Generate base feed
  const baseFeed = await generateBaseFeed(userId, feedType);
  
  // 2. Get active ads for feed
  const ads = await adService.getActiveAds({
    placement: 'feed-algorithmic',
    targetAudience: getUserProfile(userId)
  });
  
  // 3. Calculate insertion points
  const insertionPoints = calculateAdInsertionPoints(baseFeed, ads);
  
  // 4. Insert ads into feed
  const feedWithAds = insertAdsIntoFeed(baseFeed, ads, insertionPoints);
  
  return feedWithAds;
}
```

#### Ad Service (New Service)

A new ad service manages campaigns, impressions, and verification:

**Endpoints:**
- `POST /campaigns` - Create ad campaign
- `GET /campaigns` - List campaigns (with filters)
- `GET /campaigns/:id` - Get campaign details
- `PUT /campaigns/:id` - Update campaign
- `POST /campaigns/:id/pause` - Pause campaign
- `POST /campaigns/:id/resume` - Resume campaign
- `GET /ads/active` - Get active ads for placement
- `POST /impressions` - Create impression
- `POST /impressions/:id/verify` - Verify impression
- `POST /impressions/:id/click` - Record click
- `GET /impressions` - List impressions (with filters)
- `GET /analytics/campaign/:id` - Get campaign analytics

### Prediction Market Integration

When an ad campaign is created, a prediction market is automatically created for community feedback:

1. **Market Creation**
   - Campaign creation triggers PM creation
   - Market focuses on ad quality and relevance
   - Safety metric: `ad-quality` (new metric type)
   - Market pool: Percentage of campaign budget (e.g., 5-10%)

2. **Market Resolution**
   - Market resolves based on:
     - User engagement metrics (CTR, conversion rate)
     - Community feedback (bets on quality)
     - Ad performance vs. organic content
   - Resolution affects:
     - Ad visibility/priority
     - Advertiser reputation
     - Future campaign eligibility

3. **Community Feedback**
   - Users can bet on ad quality
   - High-quality ads get better placement
   - Low-quality ads may be deprioritized or paused

### Customer Journey: Promoting Content

#### Journey 7: Creating an Ad Campaign

1. **Select Content to Promote**
   - User navigates to their post or dApp
   - Clicks "Promote" button
   - System loads content details

2. **Configure Campaign**
   - Set budget (total and optional daily limit)
   - Set maximum bid per impression
   - Select placements:
     - Pre-dApp display
     - Algorithmic feeds
     - Category feeds
   - Choose verification method:
     - Cookie-based (for dApps)
     - Checksum-based (for posts/dApps)
   - Optional: Set targeting criteria
     - Categories, tags, interests
     - Exclude categories

3. **Review and Submit**
   - Preview campaign settings
   - See estimated reach and impressions
   - Confirm budget allocation
   - Submit campaign

4. **Campaign Activation**
   - System creates ad campaign record
   - Creates prediction market for ad quality
   - Campaign status: "active"
   - Ads start appearing in selected placements

5. **Monitor Performance**
   - View campaign dashboard
   - See impressions, clicks, conversions
   - Monitor spend vs. budget
   - View prediction market status
   - Adjust campaign settings as needed

### Revenue Model

1. **Cost Per Impression (CPI)**
   - Advertisers pay per impression shown
   - Auction-based pricing (highest bid wins)
   - Minimum bid ensures quality

2. **Revenue Distribution**
   - Platform fee: 30% (supports system improvements)
   - Content creator share: 50% (if promoting someone else's content)
   - Prediction market pool: 10% (for ad quality markets)
   - Remaining: 10% (reserve/additional features)

3. **Ad Shares**
   - Advertisers can share revenue with content creators
   - Enables direct payment to content creators
   - Supports ecosystem growth

### Security Considerations

1. **Ad Fraud Prevention**
   - Rate limiting on impression creation
   - Verification methods prevent fake impressions
   - Cookie/checksum validation
   - Countdown timers prevent instant verification

2. **Privacy**
   - User targeting respects privacy preferences
   - Anonymous impression tracking when possible
   - Cookie data minimized
   - GDPR compliance for ad tracking

3. **Content Safety**
   - Ads go through same moderation as regular content
   - Prediction markets provide community oversight
   - Low-quality ads can be flagged and paused

4. **Financial Security**
   - Budget limits prevent overspending
   - Daily budget caps
   - Payment verification before campaign activation
   - Refund policies for cancelled campaigns

## Security Considerations

1. **Authentication**: SUI wallet signatures + optional ZK proofs
2. **Moderation**: Prediction markets for decentralized safety reviews
3. **Sandboxing**: dApps run in isolated subdomains
4. **Content Validation**: File type and size limits
5. **Rate Limiting**: (TODO) Implement rate limiting on uploads
6. **CORS**: Configured per service
7. **HTTPS**: Automatic SSL via Caddy + Cloudflare DNS
8. **Ad Verification**: Cookie and checksum methods prevent ad fraud

## Future Enhancements

1. **Database Persistence**: Replace in-memory storage with databases
2. **CDN Integration**: Faster content delivery
3. **Compression**: Compress uploaded files
4. **Encryption**: Encrypt sensitive data at rest
5. **Access Control**: Fine-grained permissions
6. **Batch Operations**: Batch file uploads
7. **Subdomain Support**: `yourname.dlux.io` in addition to `@yourname`
8. **Transfer**: Allow transferring vanity addresses
9. **Social Features**: Follow/unfollow, activity feed
