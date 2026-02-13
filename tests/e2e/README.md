# E2E Tests

End-to-end tests for DLUX-SUI platform using Playwright.

## Testing Style (Project Direction)

E2E tests follow **[Testing Style](../../docs/testing-style.md)**:

- **Playwright-only**: All interaction via `page.*` / `locator.*`. No direct backend HTTP.
- **Multiple user-agents**: Same specs run on Chromium, Firefox, WebKit (see `playwright.config`).
- **Bundled on testnet**: Built app + services vs testnet (or local validator). Never mainnet.
- **Wait-for-callback**: Use `waitForSelector`, `waitForResponse`, `expect(...).toBeVisible()`, etc. No backend polling.
- **Backend strictly no-touch**: Backend exercised only via browser actions. Proves frontend drives full stack.

Existing API-style specs (`ad-campaigns`, `ad-clicks`, `premium-content`) use `api-helpers` and are **not** style-aligned; new work should be browser-only.

## API spec and cohesion

The **API is defined as the source of truth** in [docs/api/](../../docs/api/README.md) (OpenAPI for DGraph). Social and off-chain interactions (posts, feed, subscription, governance, markets, location, campaigns, impressions) **run through DGraph**. The helper [helpers/api-helpers.ts](./helpers/api-helpers.ts) implements the same surface; [api-spec.spec.ts](./api-spec.spec.ts) runs DGraph flows from the spec. See [docs/architecture-cohesion.md](../../docs/architecture-cohesion.md).

### API specs vs browser E2E

| Type | Specs | Description |
|------|--------|-------------|
| **API / integration** | `api-spec`, `ad-campaigns`, `ad-clicks`, `billing`, `subscription`, `governance`, `location-subscription`, `premium-content`, `pm-markets`, `social-posts` | Call services via [api-helpers](./helpers/api-helpers.ts). Validate API contract and DGraph flows. Require `*_SERVICE_URL` and sometimes deployed routes. |
| **Browser E2E** | `user-journey-full`, `content-creation-full`, `ad-journey-browser`, `click-bundling-full`, `subscribe-journey-full`, `revenue-distribution-full`, `dapp-pm-journey` (browser steps) | Playwright-only, backend no-touch where possible. Require `E2E_BASE_URL` (built app); some require seeded data (e.g. dApps in hub). |

**Required env:** See [E2E_AUDIT_AND_IMPROVEMENTS.md](./E2E_AUDIT_AND_IMPROVEMENTS.md) for skip reasons and env checklist; [COVERAGE_VS_DOCS_AND_API.md](./COVERAGE_VS_DOCS_AND_API.md) for coverage vs docs/API.

## Test Structure

```
tests/e2e/
├── helpers/
│   ├── api-helpers.ts    # API client (aligned with docs/api)
│   └── test-data.ts      # Test data factories
├── api-spec.spec.ts      # DGraph flows from spec (health, social, subscription, governance, markets)
├── ad-campaigns.spec.ts # Ad campaign flow tests
├── ad-clicks.spec.ts     # Ad click/conversion flow tests
├── social-posts.spec.ts  # Social posts through DGraph
└── premium-content.spec.ts # Premium content flow tests
```

## Prerequisites

1. **Services Running**: All services must be running on localhost:
   - DGraph Service: `http://localhost:3003` (required for ad campaign tests)
   - Walrus Service: `http://localhost:3002` (required for click/conversion and premium content tests)
   - SUI Service: `http://localhost:3001` (optional for API E2E tests)

   **To start services:**
   ```bash
   # Start all services (runs dev scripts in all workspaces)
   npm run dev:all
   # OR
   npm run dev
   
   # Or start individual services in separate terminals
   cd services/dgraph-service && npm run dev
   cd services/walrus-service && npm run dev
   cd services/sui-service && npm run dev
   ```

2. **Playwright Browsers**: Install browsers (run once). Style-aligned E2E run across Chromium, Firefox, WebKit:
   ```bash
   npx playwright install
   ```

3. **Verify Services**: Tests will automatically skip if services aren't running. To verify:
   ```bash
   curl http://localhost:3003/health  # Should return JSON with status: "ok"
   curl http://localhost:3002/health  # Should return JSON with status: "ok"
   ```

## Running Tests

### Local Vue app + real backend (dlux.io)

Run the Vue app on **localhost** talking to the **live** dlux.io backends (no local services required). Then run E2E against that local app (no wallet transactions; sign-in flows are fine).

1. **Start the Vue dev server** (uses `frontend/vue-app/.env.development` which points at gql.dlux.io, sui.dlux.io, walrus.dlux.io):
   ```bash
   cd frontend/vue-app && npm run dev
   ```
   App is at **http://localhost:3000**.

2. **In another terminal**, run E2E against localhost (chromium only; wallet-heavy specs are already excluded):
   ```bash
   E2E_BASE_URL=http://localhost:3000 npx playwright test --project=chromium
   ```

Or run only the E2E command (with dev server already running on port 3000):
   ```bash
   npm run test:e2e:local
   ```

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run with UI Mode
```bash
npm run test:e2e:ui
```

### Run in Headed Mode (see browser)
```bash
npm run test:e2e:headed
```

### Run in Debug Mode
```bash
npm run test:e2e:debug
```

### Run E2E with Real Slush Wallet
Tests wallet login and social interactions with actual signing via the Slush Chrome extension.

```bash
# 1. Download Slush extension (or set SLUSH_EXTENSION_PATH manually)
npm run slush:download

# 2. Run Slush E2E (browser opens; complete wallet setup if prompted)
npm run test:e2e:slush
```

Requires: Chromium, Slush extension. The browser runs in headed mode. Ensure your Slush wallet has testnet SUI for gas. See `scripts/download-slush-extension.mjs` for manual extraction if automated download fails.

**Full journey** (`full-journey-real.spec.ts`): Connect → edit profile → verify UX → post dApp → open sandbox → verify site-scoped auth cookie → ad network (consent/overlay). Same command; runs after wallet-login-real.

### Run Specific Test File
```bash
npx playwright test ad-campaigns
```

## Test Scenarios

### Ad Campaign Flow (`ad-campaigns.spec.ts`)
- ✅ Create campaign
- ✅ Retrieve campaign
- ✅ List campaigns by advertiser
- ✅ Select ad for placement
- ✅ Record impression
- ✅ Pause and resume campaign
- ✅ Get campaign analytics
- ✅ Get advertiser analytics
- ✅ Cancel campaign

### Ad Click/Conversion Flow (`ad-clicks.spec.ts`)
- ✅ Create campaign for click testing
- ✅ Give consent for ad tracking
- ✅ Click ad and receive token
- ✅ Record conversion with click token
- ✅ Verify impression was created

### Premium Content Flow (`premium-content.spec.ts`)
- ✅ List premium content for dApp
- ✅ Check access status
- ✅ Get user purchases
- ✅ Get owner earnings

### dApp + PM Journey (`dapp-pm-journey.spec.ts`)
- ✅ Create dApp with posting fee (PM created)
- ✅ dApp appears in list API and in Hub UI
- ✅ Safety API returns lessTested/unknown
- ✅ Hub shows dApp, View opens detail, Open in Sandbox link present
- ✅ Open Sandbox and see safety banner (less tested)
- ✅ Place bet on PM (if market exists) and re-check safety

Run against **test.dlux.io**:
```bash
E2E_BASE_URL=https://test.dlux.io SUI_SERVICE_URL=https://sui.dlux.io DGRAPH_SERVICE_URL=https://gql.dlux.io npx playwright test dapp-pm-journey --project=chromium
```

**Note:** The Vue app on test.dlux.io must be built with `VITE_SUI_SERVICE_URL=https://sui.dlux.io` (and `VITE_DGRAPH_SERVICE_URL=https://gql.dlux.io` if the hub uses DGraph) so the Hub and detail page call the same backends. Otherwise the Hub will request localhost and show no dApps.

See **[USER_JOURNEYS_PROOF_STATUS.md](./USER_JOURNEYS_PROOF_STATUS.md)** for which user journeys have E2E proof (browser/API against test.dlux.io) and which are missing, plus redeploy instructions.

## Environment Variables

Set these environment variables to override default service URLs:

```bash
export SUI_SERVICE_URL=http://localhost:3001
export DGRAPH_SERVICE_URL=http://localhost:3003
export WALRUS_SERVICE_URL=http://localhost:3002
export E2E_BASE_URL=http://localhost:3000
```

## Full E2E Tests with Local Testnet

For complete end-to-end testing with:
- ✅ Local Sui validator (local testnet)
- ✅ Real wallet signing
- ✅ On-chain contract interactions
- ✅ Real Walrus storage

See **[FULL_E2E_SETUP.md](./FULL_E2E_SETUP.md)** for complete setup instructions.

### Quick Start for Full E2E Tests

```bash
# 1. Start local Sui validator
sui-test-validator

# 2. Deploy contracts (in another terminal)
cd contracts/metadata_pm
sui client publish --gas-budget 100000000
export PACKAGE_ID=<package-id-from-output>

# 3. Start services with testnet config
export SUI_RPC_URL=http://localhost:9000
npm run dev:all

# 4. Run full E2E tests
npm run test:e2e:full
```

## Limitations

### What Can Be Tested on Localhost (API Tests)
- ✅ API endpoints (all services)
- ✅ Service-to-service communication
- ✅ Database operations
- ✅ Business logic flows
- ✅ Ad campaign management
- ✅ Impression tracking
- ✅ Analytics endpoints

### What Requires Full E2E Setup (Local Testnet)
- ✅ On-chain contract interactions (with local validator)
- ✅ Real wallet signing (with test keypairs)
- ✅ Transaction execution (on local testnet)
- ✅ Event indexing and verification
- ⚠️ Real Walrus network operations (may use mock for local testing)
- ⚠️ Real Seal encryption/decryption (may use mock for local testing)

### What Requires Staging/Production
- ❌ dApp sandbox subdomains (requires DNS)
- ❌ Real Walrus network operations (production network)
- ❌ Real Seal encryption/decryption (production network)
- ❌ SSL/HTTPS flows
- ❌ Caddy reverse proxy routing
- ❌ Browser-based wallet interactions (requires staging environment)

## Notes

- **Style-aligned E2E**: Use Playwright only, multiple user-agents, testnet, `waitFor*`-style sync, backend no-touch. See [Testing Style](../../docs/testing-style.md).
- API-style tests use in-memory test mode for repositories and may mock external services.
- Tests are designed to run independently; each test file can run standalone.
- Health checks verify services before running (API-style tests only; style-aligned E2E never call backend directly).

## Spec Environment Requirements

| Spec file | Requires services | Requires wallet | Browser tests | Notes |
|-----------|------------------|-----------------|---------------|-------|
| feature-coverage.spec.ts | — | — | yes | Runs against any deployed env |
| ad-campaigns.spec.ts | SUI, DGraph | payer keypair | no | API-only; needs deployed contracts |
| ad-clicks.spec.ts | SUI, DGraph | payer keypair | no | API-only |
| ad-journey-browser.spec.ts | — | — | yes | Browser-only; skips if hub empty |
| ad-journey-full.spec.ts | SUI, DGraph | payer keypair | no | On-chain ad campaign; needs funded wallet |
| ad-settlement.spec.ts | SUI | — | no | API-only |
| api-spec.spec.ts | SUI, DGraph | — | no | DGraph API health |
| billing-journey-browser.spec.ts | — | — | yes | Browser-only |
| billing.spec.ts | DGraph | — | no | API-only |
| click-bundling-full.spec.ts | — | — | yes | Browser-only |
| content-creation-full.spec.ts | — | — | yes | Browser-only |
| dapp-pm-journey.spec.ts | SUI, DGraph | payer keypair | yes | API + browser |
| dapp-posting-onchain.spec.ts | SUI (deployed contracts) | slush mnemonic | no | PACKAGE_ID, POSTING_POOL_ID required |
| governance-journey-browser.spec.ts | — | — | yes | Browser-only |
| governance.spec.ts | DGraph | — | no | API-only |
| location-journey-browser.spec.ts | — | — | yes | Browser-only |
| location-subscription.spec.ts | SUI, DGraph | payer keypair | no | API-only |
| pm-markets.spec.ts | DGraph | — | no | API-only |
| post-dapp-to-hub.spec.ts | — | — | yes | Browser-only |
| premium-content-browser.spec.ts | — | — | yes | Browser-only |
| premium-content.spec.ts | DGraph, Walrus | — | no | API-only |
| revenue-distribution-full.spec.ts | — | — | yes | Browser-only |
| sandbox-dapp-proof.spec.ts | SUI, Sandbox | — | yes | API + browser |
| skill-marketplace-journey.spec.ts | SUI, DGraph | payer keypair | yes | Gold skill marketplace spec |
| social-interactions.spec.ts | DGraph | payer keypair | no | API-only |
| social-journey-browser.spec.ts | — | — | yes | Browser-only |
| social-pm-thread.spec.ts | SUI, DGraph | payer keypair | no | Social on PM thread |
| social-posts.spec.ts | DGraph | payer keypair | no | API-only |
| subscribe-journey-browser.spec.ts | — | — | yes | Browser-only |
| subscribe-journey-full.spec.ts | — | — | yes | Browser-only |
| subscription-real-sui.spec.ts | SUI | payer keypair | no | Real SUI transfer |
| subscription.spec.ts | DGraph | — | no | API-only |
| sui-auth-suins.spec.ts | SUI | — | no | Auth challenge API |
| user-journey-full.spec.ts | — | — | yes | Browser-only |
| walrus-blobs.spec.ts | Walrus | — | no | API-only |

### Running against test.dlux.io (staging)

```bash
E2E_BASE_URL=https://test.dlux.io \
  SUI_SERVICE_URL=https://sui.dlux.io \
  DGRAPH_SERVICE_URL=https://gql.dlux.io \
  WALRUS_SERVICE_URL=https://walrus.dlux.io \
  TEST_SLUSH_MNEMONIC="<your-mnemonic>" \
  npx playwright test --project=chromium
```

### Running against production (dlux.io)

```bash
npm run test:e2e:production
```
