# Sandbox Service Documentation

## Overview

The Sandbox Service provides a secure environment for executing user-generated dApps with automatic PWA (Progressive Web App) installation support. It runs on port 3007 and handles wildcard subdomain requests for `*.walrus.dlux.io`.

## Features

1. **Metadata Endpoint for Bots/Crawlers**: Returns SUI metadata without loading the full dApp
2. **Dynamic Web App Manifest**: Generates `manifest.json` for PWA installation
3. **Service Worker**: Provides offline caching and PWA functionality
4. **Wallet/Nav Script Injection**: Automatically injects wallet and navigation scripts into all dApps
5. **Content Verification**: Ensures dApps are served only if posted by the author
6. **Safety Warnings**: Displays warnings based on prediction market status
7. **Age Confirmation Dialogs**: Shows age verification for NSFW/age-restricted content
8. **GDPR Cookie Banners**: Non-blocking cookie consent banners for GDPR compliance

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
  "url": "https://permlink.walrus.dlux.io/@author/permlink",
  "type": "website",
  "site_name": "DLUX-SUI",
  "author": "0x...",
  "tag": "gaming"
}
```

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

## URL Structure

dApps are accessed via the following URL pattern:

```
https://{permlink}.walrus.dlux.io/@{author}/{permlink}
```

**Example:**
```
https://mygame.walrus.dlux.io/@0xabc123/mygame
```

Where:
- `permlink`: Unique identifier for the dApp (used as subdomain)
- `author`: SUI address of the dApp creator

## Caddy Configuration

The Caddyfile includes special handling for bot/crawler requests:

```caddy
*.walrus.dlux.io {
    # Metadata endpoint for bots/crawlers
    @metadata {
        header User-Agent /bot|crawl|spider|slurp|google|bing|yandex/i
        method HEAD
        path_regexp ^(?:/([a-zA-Z]{3,}))?/@([^/]+)/([^/]+)$
    }
    handle @metadata {
        rewrite * /metadata?author={re.2}&permlink={re.3}&tag={re.1}
        reverse_proxy localhost:3007
    }
    
    # Regular dApp content
    handle {
        reverse_proxy localhost:3007
    }
}
```

This configuration:
1. Detects bot/crawler requests via User-Agent header
2. Extracts `author`, `permlink`, and optional `tag` from the URL
3. Rewrites the request to the `/metadata` endpoint
4. Returns only metadata (not the full dApp) for SEO and preview purposes

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
