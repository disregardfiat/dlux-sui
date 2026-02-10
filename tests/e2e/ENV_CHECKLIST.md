# E2E Environment Checklist

Use this checklist to get a **green E2E run**. Required env and services depend on which specs you run.

## Required for API / integration specs

| Spec(s) | Required env | Required services |
|--------|--------------|--------------------|
| api-spec, social-posts, subscription, governance, pm-markets, ad-campaigns, location-subscription | `DGRAPH_SERVICE_URL` (default `http://localhost:3003`) | DGraph service (port 3003) |
| ad-clicks, premium-content | `DGRAPH_SERVICE_URL`, `WALRUS_SERVICE_URL` (default `http://localhost:3002`) | DGraph, Walrus |
| billing, dapp-pm-journey (steps 1–3) | `SUI_SERVICE_URL` (default `http://localhost:3001`) | SUI service |
| subscription-real-sui | `DGRAPH_SERVICE_URL`, `SUI_SERVICE_URL`, testnet RPC, funded wallet | DGraph, SUI, testnet |

## Required for browser E2E

| Spec(s) | Required env | Required state |
|--------|--------------|----------------|
| user-journey-full, ad-journey-browser, click-bundling-full, revenue-distribution-full | `E2E_BASE_URL` (default `http://localhost:3000`) | Built app served at base URL; **at least one dApp in hub** (run seed script) |
| dapp-pm-journey (browser steps) | `E2E_BASE_URL`, `SUI_SERVICE_URL`, `DGRAPH_SERVICE_URL` | Same; frontend must be built with `VITE_SUI_SERVICE_URL` / `VITE_DGRAPH_SERVICE_URL` pointing at same backends |
| content-creation-full (form flow) | `E2E_BASE_URL` | Wallet extension or mock for auth |
| subscribe-journey-full | `E2E_BASE_URL` | Profile link and Subscribe UI present |

## Quick start (all services + seed)

```bash
# 1. Start services (pick one)
npm run dev:all
# OR Docker: npm run docker:e2e

# 2. Seed one dApp for browser specs (optional but recommended)
node tests/e2e/scripts/seed-for-e2e.js
# OR: SUI_SERVICE_URL=http://localhost:3001 node tests/e2e/scripts/seed-for-e2e.js

# 3. Run E2E
npm run test:e2e
```

## Skip reasons

If a test skips, the message indicates the missing requirement (e.g. "DGraph service not available", "No dApps in hub yet"). See `E2E_AUDIT_AND_IMPROVEMENTS.md` and `COVERAGE_PERCENTAGES.md`.

**Against test.dlux.io** (E2E_BASE_URL + SUI + DGRAPH + WALRUS): API batch typically **35 passed, 7 skipped**. Skips: billing verify-payment (live testnet), location update/preferences/subscribe/unsubscribe (require DGraph mutate for location preferences; may skip if deployed DGraph is read-only).

## Why E2E can pass when the app in the browser fails

- **E2E tests** use **their own** env vars (`DGRAPH_SERVICE_URL`, `SUI_SERVICE_URL`, etc.) when making API requests. When you run against test.dlux.io, those are set to `https://gql.dlux.io`, `https://sui.dlux.io`, etc., so tests hit the real backends and pass.
- **The Vue app** gets API base URLs **at build time** from `VITE_DGRAPH_SERVICE_URL`, `VITE_SUI_SERVICE_URL`, etc. If those are not set when you build, the app bakes in `http://localhost:3003` (and similar). So:
  - If you open **test.dlux.io** in a browser, the app may still request **localhost** (wrong) unless the deployed build was made with the correct `VITE_*` env.
  - If you run the app **locally** and see `net::ERR_BLOCKED_BY_CLIENT`, that is usually a **browser extension** (ad blocker, privacy tool) blocking the request—not the service being down. Fix: allow this site in the blocker, or use a clean profile.
- **Deploy contract:** For test.dlux.io (or any deployed frontend), build with `VITE_DGRAPH_SERVICE_URL`, `VITE_SUI_SERVICE_URL`, and `VITE_WALRUS_SERVICE_URL` set to the real backends. See `frontend/vue-app/.env.example`.
