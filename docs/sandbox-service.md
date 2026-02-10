# Sandbox Service Documentation

## Overview

The Sandbox Service provides a secure environment for executing user-generated dApps with automatic PWA (Progressive Web App) installation support. It runs on port 3007 and handles wildcard subdomain requests for `*.walrus.dlux.io`.

## Address-matched subdomains (Walrus)

dApp URLs use **address-matched subdomains** so that the hostname proves the content is only what that address could have posted (same sandbox as posting).

- **Subdomain format**: `h` + hex of the dApp **owner** SUI address (no `0x`). DNS labels are limited to 63 chars (RFC 1035), so we use `h` + up to 62 hex chars (63 chars total), e.g. `h1a2b3c4d5e6f7890...`. This is DNS-safe (label starts with a letter) and gives strong uniqueness (62 hex = 31 bytes).
- **URL pattern**: `https://h<hex>.walrus.dlux.io/@<owner_or_suins>/<permlink>` or `https://<suins>.walrus.dlux.io/@<owner_or_suins>/<permlink>` (SuiNS subdomain)
- **Validation**: The sandbox calls SUI `dapps/lookup(author, permlink)` and checks that `addressSubdomain(lookup.owner) === subdomain`. If they don’t match, it returns 403. Only Walrus content tied to that owner (via lookup) is served.
- **Content flow**: Lookup returns `blobIds` and `manifest.entryPoint`. The entry blob is resolved from `manifest.entryPoint` (if hex) or `blobIds[0]`. If the entry blob is not HTML (e.g. image), the sandbox tries to find an HTML blob in `blobIds` via Walrus `/blobs/:id/info` and uses that instead. The HTML blob is fetched from Walrus, scripts (wallet, nav, social, ads) are injected, and blob URLs in the HTML are rewritten to same-origin `/walrus/:blobId` so assets load from the sandbox.
- **Folder uploads**: When dApps are posted with `manifest.pathMap` (path → blobId), the sandbox serves asset requests at `/@owner/permlink/path` (e.g. `/@0x.../myapp/js/app.js`) by looking up the path in `pathMap` and fetching the blob from Walrus. This supports folder uploads where the HTML references assets with relative paths.
- **Remix UI** (`remix.html`): Include `remix.html` in your folder upload to enable the Remix button. The sandbox serves `/@owner/permlink/remix` by looking up `pathMap["remix.html"]`. The Remix page typically lets users swap assets (e.g. a video player HTML with a different media file) and post a new dApp. The Remix button is hidden when no `remix.html` is present.

## Features

1. **Address-matched subdomains**: Subdomain = owner address prefix; only that owner’s dApp content is served (see above).
2. **Metadata Endpoint for Bots/Crawlers**: Returns SUI metadata without loading the full dApp
3. **Dynamic Web App Manifest**: Generates `manifest.json` for PWA installation
4. **Service Worker**: Provides offline caching and PWA functionality
5. **Wallet/Nav/Social Script Injection**: Automatically injects wallet, navigation, and social scripts into all dApps, including the top tab overlay
6. **Content Verification**: Ensures dApps are served only if posted by the author (enforced by subdomain match)
6. **Safety Warnings**: Displays warnings based on prediction market status
7. **Age Confirmation Dialogs**: Shows age verification for NSFW/age-restricted content
8. **GDPR Cookie Banners**: Non-blocking cookie consent banners for GDPR compliance
9. **Privacy-Preserving Ads**: Ad overlays with ZK proof verification before content

## Endpoints

### `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "sandbox-service",
  "timestamp": "2025-01-13T..."
}
```

### `/metadata`
Returns metadata for bots and crawlers. This endpoint is triggered by Caddy when a bot requests a dApp URL.

**Query Parameters:**
- `author` (required): SUI address of the dApp author
- `permlink` (required): Unique identifier for the dApp
- `tag` (optional): Category tag for the dApp

**Response:**
```json
{
  "title": "dApp: permlink",
  "description": "Decentralized application by author",
  "url": "https://h1a2b3c4d5e6f7890...walrus.dlux.io/@author/permlink",
  "type": "website",
  "site_name": "DLUX-SUI",
  "author": "0x...",
  "tag": "gaming"
}
```
The `url` uses the **address subdomain** (h + hex of owner, DNS-safe, up to 63 chars) when lookup succeeds; otherwise falls back to permlink subdomain.

### `/manifest.json`
Generates a Web App Manifest for PWA installation. The manifest is dynamically generated based on the subdomain and dApp metadata from SUI/dGraph.

**Response:**
```json
{
  "name": "dApp: subdomain",
  "short_name": "subdomain",
  "description": "DLUX-SUI dApp",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#667eea",
  "orientation": "any",
  "scope": "/",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

### `/sw.js`
Service Worker for PWA functionality. Provides offline caching and enables "Add to Home Screen" functionality.

**Features:**
- Caches dApp assets for offline use
- Intercepts fetch requests for offline support
- Versioned cache for cache invalidation

### `/wallet-script.js`
Injected JavaScript for SUI wallet integration. Provides a standardized API for dApps to interact with SUI wallets.

**API:**
```javascript
window.dluxWallet = {
  connect: async () => {
    // Connects to SUI wallet
    if (window.suiWallet) {
      return await window.suiWallet.connect();
    }
    throw new Error('SUI wallet not available');
  },
  sign: async (message) => {
    // Signs a message with the wallet
    if (window.suiWallet) {
      return await window.suiWallet.signMessage({ message });
    }
    throw new Error('SUI wallet not available');
  }
};
```

### `/nav-script.js`
Injected JavaScript for navigation updates. Allows dApps to update navigation state.

**API:**
```javascript
window.dluxNav = {
  navigate: (path) => {
    // Navigate to a new path
    window.location.href = path;
  },
  update: () => {
    // Update navigation state
    if (window.dluxNavUpdateCallback) {
      window.dluxNavUpdateCallback();
    }
  },
  onUpdate: (callback) => {
    // Register callback for navigation updates
    window.dluxNavUpdateCallback = callback;
  }
};
```

### `/social-script.js`
Injected JavaScript for social interactions inside dApps.

**API:**
```javascript
window.dluxSocial = {
  getContext: () => ({ author, permlink, dappId }),
  getAuthSession: () => ({ token, user }),
  listPosts: async ({ dappId, limit, offset }) => {},
  createPost: async ({ content, dappId, parentId }) => {},
  createInteraction: async ({ type, targetId, targetType }) => {},
  openProfile: (identifier) => {}
};
```

The script also injects a lightweight top tab that opens a transparent panel for:
- PM status
- Tags/labels
- Metadata summary
- Remix shortcut

The overlay resolves dApp metadata from the SUI service:
- `GET /dapps/lookup?author={address}&permlink={permlink}`

Social actions require explicit wallet connection and signatures. The JWT cookie
can be used for read-only personalization but is not used to authorize social
interactions from within dApps.

### `/ads` hook (injected via social script)
The injected script exposes a simple ad hook for dApps:

```javascript
window.dluxAds = {
  showAd: async ({ type, cooldownMs }) => ({ shown, blocked, retryInMs }),
  getCooldown: () => ({ last, remainingMs })
};
```

Ad types:
- `gate`: dApp gates content until ad is shown
- `slip`: dApp can trigger ads at runtime
- `install`: ad shown before a PWA install

Ads are rate-limited per user (default 10 minutes). Active subscriptions (via JWT
user context) disable ads.

The sandbox also wires install ads by intercepting the `beforeinstallprompt` event
and showing an `install` ad before prompting the PWA install dialog.

## URL Structure

dApps are accessed via **address-matched subdomains** (Walrus, IPFS-style):

```
https://h{hex}.walrus.dlux.io/@{author}/{permlink}
```

- **Subdomain**: `h` + hex of the dApp **owner** SUI address (no `0x`), up to 62 hex chars (63 chars total per DNS label). DNS-safe and strongly unique. Proves the host only serves content that this address could have posted.
- **author**: SUI address or SuiNS name (e.g. `alice.sui`); resolved to owner by `dapps/lookup`.
- **permlink**: Unique identifier for the dApp (e.g. `mygame`).

**Example:**
```
https://h1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef12.walrus.dlux.io/@0x1a2b.../mygame
```

### `/@owner/permlink/remix` (Remix UI)

When a dApp includes `remix.html` in its folder upload (and thus `manifest.pathMap["remix.html"]`), the sandbox serves it at `/@owner/permlink/remix`. The Remix page typically lets users swap assets (e.g. a video player HTML with a different media file) and post a new dApp. The Remix button on dApp cards and detail pages is **only shown** when `pathMap["remix.html"]` exists. Example: the `coastal-bike-tour-in-buenos-aires` demo has `remix.html` for adding custom 360° image URLs.

### `/walrus/:blobId` (same-origin assets)

The sandbox proxies `GET /walrus/:blobId` to the Walrus service so dApp HTML can reference assets with same-origin URLs (e.g. `/walrus/abc123...`) instead of cross-origin Walrus URLs. Caddy forwards `*.walrus.dlux.io/walrus/*` to the sandbox; the sandbox then proxies to `WALRUS_SERVICE_URL/blobs/:blobId`.

## Caddy Configuration

The Caddyfile (e.g. `/etc/caddy/Caddyfile`) routes `*.walrus.dlux.io` to the sandbox with bot metadata and Walrus proxy handling (IPFS-style for Walrus):

```caddy
*.walrus.dlux.io {
    # Metadata endpoint for bots/crawlers (preview without loading full dApp)
    @metadata {
        header User-Agent /bot|crawl|spider|slurp|google|bing|yandex/i
        method HEAD
        path_regexp ^(?:/([a-zA-Z]{3,}))?/@([^/]+)/([^/]+)$
    }
    handle @metadata {
        rewrite * /metadata?author={re.2}&permlink={re.3}&tag={re.1}
        reverse_proxy localhost:3007
    }
    
    # Same-origin dApp assets: /walrus/* -> sandbox -> Walrus blobs
    handle /walrus/* {
        reverse_proxy localhost:3007
    }
    
    # Default: serve dApp document (address-matched HTML from Walrus or shell)
    handle {
        reverse_proxy localhost:3007
    }
}
```

This configuration:
1. Detects bot/crawler requests via User-Agent header
2. Extracts `author`, `permlink`, and optional `tag` from the URL and rewrites to `/metadata`
3. Sends `/walrus/*` to the sandbox, which proxies to Walrus blobs for same-origin asset loading
4. Sends all other requests to the sandbox for address-matched dApp HTML or fallback shell

## Required Data Structures

### SUI Blockchain Data

When registering a dApp on SUI, the following data structure is required:

```typescript
interface SUIdAppRegistration {
  // Required fields
  author: string;              // SUI address of the creator
  permlink: string;             // Unique identifier (e.g., "mygame")
  name: string;                // Display name
  description: string;          // Short description
  version: string;             // Version number (e.g., "1.0.0")
  
  // Manifest data
  manifest: {
    entryPoint: string;         // Main entry point (e.g., "/index.html")
    assets: string[];           // List of asset paths
    metadata: {
      title: string;           // Full title
      description: string;      // Full description
      thumbnail?: string;       // Thumbnail URL (for icons/manifest)
      icon?: string;            // App icon URL
    }
  };
  
  // Content references
  blobIds: string[];            // Walrus blob IDs for dApp content
  
  // Optional metadata
  tags?: string[];              // Category tags
  category?: string;             // Primary category
}
```

### dGraph Data Structure

For building web app manifests and metadata, the following dGraph schema is recommended:

```graphql
type DApp {
  id: ID!
  suiAddress: String!          # SUI object address
  author: String!              # SUI address of creator
  permlink: String!            # Unique identifier
  name: String!
  description: String!
  version: String!
  
  # Manifest data
  entryPoint: String!
  assets: [String!]!
  
  # Metadata for PWA
  title: String!
  thumbnail: String
  icon: String
  
  # PWA configuration
  display: String              # "standalone" | "fullscreen" | "minimal-ui" | "browser"
  themeColor: String
  backgroundColor: String
  
  # Content
  blobIds: [String!]!
  
  # Metadata
  tags: [String!]
  category: String
  
  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

## PWA Installation Flow

1. User visits `https://{permlink}.walrus.dlux.io/@{author}/{permlink}`
2. Browser detects `manifest.json` link in HTML
3. Service Worker is registered automatically
4. User can "Add to Home Screen" from browser menu
5. dApp is installed as a standalone PWA

## Safety Features

### Prediction-market gateway banner

The gateway (sandbox) fetches prediction-market data from `GET /safety/dapp/:dappId` and injects a **safety banner** into both Walrus-served dApp HTML and the fallback shell. The banner is shown only when there is meaningful PM data or a specific warning:

- **Overall status**: SAFE, WARNING, UNSAFE, or UNKNOWN (from resolved/active markets).
- **Negative accuracy**: When the market currently leans unsafe (`safeOdds < 0.5`) even if not yet resolved — the gateway shows a warning that the content is in the "negative accuracy range".
- **Less tested**: When there is no resolved outcome yet and either no active markets or very low total pool — the gateway shows "This content is less tested."

The safety API returns `safeOdds`, `confidence`, `negativeAccuracy`, and `lessTested` so the gateway can surface these without interpreting pool data itself. The banner is injected at the start of the document body (Walrus path) or in the shell layout (fallback).

### Age Confirmation

When a dApp has active prediction markets for `nsfw` or `age-restricted` metrics:

- A **full-screen modal dialog** appears before content loads
- Shows the highest recommended age from all active markets
- User must confirm they meet the age requirement
- Confirmation is stored in `sessionStorage` (per session)
- If user declines, they are redirected away from the dApp

**Example Markets:**
- `nsfw` → Shows "I am 18 or older" dialog
- `age-restricted` with `recommendedAge: "21+"` → Shows "I am 21 or older" dialog

### GDPR Cookie Banner

When a dApp has active markets for `gdpr-compliance` or `cookie-banner`:

- A **non-blocking banner** appears at the bottom of the page
- User can accept or decline cookies
- Preference is stored in `localStorage` (persists across sessions)
- Banner can be dismissed without blocking content
- Does not prevent dApp from loading

## Security Considerations

1. **Content Verification**: The sandbox service should verify that the dApp being served was actually posted by the author specified in the URL
2. **Script Injection**: Wallet and nav scripts are injected server-side to ensure they're always up-to-date
3. **CORS**: dApps should only be able to make requests to approved domains
4. **Sandboxing**: Consider using iframe sandboxing for additional isolation
5. **Age Verification**: Session-based confirmation prevents easy bypass (but not foolproof)
6. **GDPR Compliance**: Cookie preferences are stored client-side and should be respected by dApp code

## Future Enhancements

1. **GraphQL Integration**: Fetch dApp metadata from dGraph for more accurate manifest generation
2. **Walrus Integration**: Serve actual dApp content from Walrus blob storage
3. **Version Management**: Support multiple versions of the same dApp
4. **Analytics**: Track dApp usage and installation metrics
5. **Caching Strategy**: Implement more sophisticated caching for dApp assets

## Testing

### Test Metadata Endpoint
```bash
curl "http://localhost:3007/metadata?author=0xabc123&permlink=mygame&tag=gaming"
```

### Test Manifest
```bash
curl -H "Host: mygame.walrus.dlux.io" http://localhost:3007/manifest.json
```

### Test Service Worker
```bash
curl -H "Host: mygame.walrus.dlux.io" http://localhost:3007/sw.js
```

### Test Wallet Script
```bash
curl -H "Host: mygame.walrus.dlux.io" http://localhost:3007/wallet-script.js
```

## Implementation Status

- ✅ Caddy configuration with metadata handling
- ✅ Basic sandbox service structure
- ✅ Metadata endpoint
- ✅ Manifest generation
- ✅ Service worker generation
- ✅ Wallet/nav script injection
- ⏳ GraphQL integration for enhanced metadata
- ⏳ Walrus integration for content serving
- ⏳ Content verification
- ⏳ Enhanced PWA features
