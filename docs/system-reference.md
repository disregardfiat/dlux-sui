# System Reference (Single Source of Truth)

This page is the canonical reference for **ports**, **domains**, and **URL formats**. If another doc disagrees, **this page wins**.

## Service Ports (local defaults)

- **Vue frontend (dev / Vite)**: `3000`
- **SUI service**: `3001`
- **Walrus service**: `3002`
- **Dgraph service**: `3003`
- **Presence service (HTTP)**: `3004`
- **Presence service (WebSocket / Hocuspocus)**: `3005`
- **Vue frontend (server / PM2 on test box)**: `3006`
- **Sandbox service**: `3007`
- **Markets & governance**: Dgraph `3003`
- **MCP service**: `3009`
- **ZK service**: `3010`
- **Webhook service**: `3011`

### Reserved / External

- **SuiNS resolver**: `3012` (external; referenced by `sui-service`, not implemented in this repo)
- **Ad service**: `3013` (reserved; not implemented as a standalone service in this repo)

## Domains (test server)

From `docs/test-environment.md`, the intended public routes are:

- **Frontend**: `test.dlux.io` → Vue frontend (`3006`)
- **SUI API**: `sui.dlux.io` → SUI service (`3001`)
- **Walrus API**: `walrus.dlux.io` → Walrus service (`3002`)
- **GraphQL**: `gql.dlux.io` → Dgraph service (`3003`)
- **Presence**: `tincan.dlux.io` → Presence service (`3004`/`3005`)
- **Webhook**: `webhook.dlux.io` → Webhook service (`3011`)
- **Wildcard dApps**: `*.walrus.dlux.io` → Sandbox service (`3007`)

## Canonical URL Formats

- **Profile**: `https://dlux.io/@{suinsName}` (preferred) or `https://dlux.io/@{suiAddress}` (fallback)
- **dApp (canonical)**: `https://{permlink}.walrus.dlux.io/@{author}/{permlink}`

Notes:
- `permlink` is the **subdomain**.
- `author` is currently represented as a SUI address in the path.

## Prediction Markets (PM) Resolution Rule

PMs are **capital-weighted only**:
- Resolution is determined solely by **which side has more capital** at close.
- PMs are used to set **community tags / ratings** (NSFW, age range, cookie-banner/GDPR labels, etc.).
- PM outcomes **do not hard-censor content**; they affect labeling and (optionally) discovery/ranking.

