# E2E Test Summary

## Verification Strategy (Current)

**No CI/CD E2E until something gold.** Workflow:

1. **Iterate locally** – develop, run specs locally if desired
2. **Push** – triggers deploy to test.dlux.io
3. **Verify deploy** – confirm services are up
4. **Manual verification** – use Playwright or browser to interact with https://test.dlux.io and perform all actions

```bash
# Run Playwright against test.dlux.io
npm run test:e2e:testnet

# Or open browser and manually verify
# https://test.dlux.io
```

---

## Testing Style (Project Direction)

**See [Testing Style](../../docs/testing-style.md)** for full conventions.

E2E tests should follow:

| Rule | Description |
|------|-------------|
| **Playwright-only** | All E2E via Playwright. No direct backend HTTP from tests. |
| **Multiple user-agents** | Run same specs on Chromium, Firefox, WebKit (see `playwright.config` projects). |
| **Bundled on testnet** | Built app + services vs testnet/local validator. Never mainnet. |
| **Wait-for-callback** | Sync via Playwright waits only (`waitForSelector`, `waitForResponse`, `expect(...).toBeVisible()`, etc.). No backend polling. |
| **Playwright calls alone** | All interaction through `page.*` / `locator.*`. No axios/fetch to services. |
| **Backend strictly no-touch** | Backend exercised only as a consequence of browser actions. Proves frontend drives full stack. |

New E2E work must follow this style. Existing API-style and full E2E specs that call backend directly are integration tests; migrate them to browser-only flows where possible.

---

## What Exists

### ✅ Basic API E2E Tests (Current)

**Location:** `tests/e2e/`

**Test Files:**
- `ad-campaigns.spec.ts` - Ad campaign API flow (9 tests)
- `ad-clicks.spec.ts` - Ad click/conversion API flow (5 tests)
- `billing.spec.ts` - Billing API: overview, claim payouts, storage funding, payment verification (incl. foundation) (8 tests)
- `governance.spec.ts` - Governance API: variables (foundationShare, pmFundShare), markets (5 tests)
- `location-subscription.spec.ts` - Location & subscription: preferences, popular spots, subscribe/unsubscribe (9 tests)
- `premium-content.spec.ts` - Premium content API flow: list, access, purchases, earnings, purchase validation (8 tests)
- `subscription-real-sui.spec.ts` - Real SUI subscription on testnet: transfer SUI, create subscription, verify status (1 test)
- `pm-markets.spec.ts` - Prediction market flow: create market, place bet, get payouts (3 tests)
- `social-posts.spec.ts` - Social flow: sign message with Ed25519, POST to DGraph, get feed (2 tests)

**What They Test:**
- ✅ API endpoints (all services)
- ✅ Service-to-service communication
- ✅ Database operations (in-memory mode)
- ✅ Business logic flows
- ✅ Ad campaign management
- ✅ Impression tracking
- ✅ Analytics endpoints

**Limitations:**
- ❌ No on-chain interactions
- ❌ No real wallet signing
- ❌ No real Walrus storage
- ❌ Mocked external services

**Run:**
```bash
npm run test:e2e
```

## What's New - Full E2E Tests

### ✅ Full E2E Tests with Local Testnet (New)

**Location:** `tests/e2e/` (files ending in `-full.spec.ts`)

**Setup Guide:** `FULL_E2E_SETUP.md`

**Test Files Created:**
- `ad-journey-full.spec.ts` - Complete ad campaign journey with on-chain interactions
- `helpers/wallet-helpers.ts` - Wallet signing utilities

**What They Test:**
- ✅ On-chain contract interactions (local Sui validator)
- ✅ Real wallet signing (Ed25519 keypairs)
- ✅ Transaction execution and verification
- ✅ Event emission and indexing
- ✅ Complete ad network journeys
- ✅ Revenue distribution flows

**Requirements:**
- Local Sui validator running (`sui-test-validator`)
- Contracts deployed to local testnet
- Test accounts funded
- Services configured for local testnet

**Run:**
```bash
# Setup first (see FULL_E2E_SETUP.md)
npm run test:e2e:full
```

## Test Coverage Comparison

| Feature | API E2E Tests | Full E2E Tests |
|---------|---------------|----------------|
| API Endpoints | ✅ | ✅ |
| Service Communication | ✅ | ✅ |
| Database Operations | ✅ | ✅ |
| On-Chain Interactions | ❌ | ✅ |
| Wallet Signing | ❌ | ✅ |
| Transaction Execution | ❌ | ✅ |
| Event Verification | ❌ | ✅ |
| Walrus Storage | ⚠️ Mock | ⚠️ Mock/Real |
| Seal Encryption | ⚠️ Mock | ⚠️ Mock/Real |

## Recommended Testing Strategy

### 1. Preferred: Playwright-only, multi–user-agent, testnet, backend no-touch (style-aligned)
- Playwright specs only; all interaction via browser (`page.*` / `locator.*`).
- Run across Chromium, Firefox, WebKit (multiple user-agents).
- App bundled, services on testnet (or local validator). Use `waitFor*` / `expect(...).toBeVisible()` etc.; no backend polling.
- **Command:** `npm run test:e2e` (when specs are style-aligned and run against testnet).

### 2. Integration / API-style (legacy until migrated)
- **API E2E** (`ad-campaigns`, `ad-clicks`, `premium-content`): Hit services via `api-helpers`. Fast, but **not** style-aligned. Use for quick API smoke tests only.
- **Full E2E** (`ad-journey-full` etc.): Use testnet + wallet, but still call backend. Migrate to Playwright-only, backend no-touch.
- **Commands:** `npm run test:e2e`, `npm run test:e2e:full`.

### 3. Staging
- Same Playwright-only, multi–user-agent, backend no-touch style. Run against staging (testnet) with real wallet extensions where configured.

## Next Steps

### To Complete Full E2E Coverage

1. **Create style-aligned Playwright E2E (backend no-touch, multi–user-agent, testnet):**
   - [x] `content-creation-full.spec.ts` - Content creation with ad marking (browser-only)
   - [x] `user-journey-full.spec.ts` - User viewing, signing, clicking ads (browser-only)
   - [x] `subscribe-journey-full.spec.ts` - Subscription flow (browser-only, scaffold)
   - [x] `click-bundling-full.spec.ts` - Click aggregation and redemption (browser-only, scaffold)
   - [x] `revenue-distribution-full.spec.ts` - PM resolution and payouts (browser-only, scaffold)
   - [x] `ad-journey-browser.spec.ts` - Ad journey (browser-only, style-aligned)

2. **Align existing specs with [Testing Style](../../docs/testing-style.md):**
   - [x] Run E2E across Chromium, Firefox, WebKit (see `playwright.config` projects) ✅
   - [x] Ensure all E2E run against bundled app + testnet (CI workflow builds frontend, uses testnet) ✅
   - [x] Document legacy `ad-journey-full.spec.ts` as integration (uses backend) ✅

3. **Enhance Test Helpers (Playwright-only, no backend HTTP):**
   - [x] `wallet-ui-helpers.ts` - Wallet UX patterns via `page.*` (e.g. connect, sign) ✅
   - [x] `testnet-helpers.ts` - Testnet setup/teardown (infra only; tests still backend no-touch) ✅

4. **CI/CD Integration:**
   - [x] GitHub Actions workflow for style-aligned E2E ✅
   - [x] Automated local validator + testnet setup ✅
   - [x] Contract deployment automation ✅

## Documentation

- **[Testing Style](../../docs/testing-style.md)** - Project E2E conventions (Playwright-only, multi–user-agent, testnet, backend no-touch)
- **[FULL_E2E_SETUP.md](./FULL_E2E_SETUP.md)** - Complete setup guide for full E2E tests
- **[README.md](./README.md)** - Basic E2E test documentation
- **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** - Docker-based testing
- **[Ad Network Journeys](../../docs/ad-network-journeys.md)** - Complete journey documentation

## Quick Reference

```bash
# Basic API E2E tests (no testnet needed)
npm run test:e2e

# Full E2E tests (requires local validator)
# 1. Start validator: sui-test-validator
# 2. Deploy contracts
# 3. Configure services
npm run test:e2e:full

# Run against testnet (test.dlux.io)
npm run test:e2e:testnet     # All E2E with testnet URLs

# Run with UI
npm run test:e2e:ui          # API tests
npm run test:e2e:full:ui    # Full tests

# Debug mode
npm run test:e2e:debug      # API tests
npm run test:e2e:full:debug # Full tests

# Style-aligned browser-only E2E (Playwright-only, multi–user-agent, testnet, backend no-touch)
npm run test:e2e:browser    # Run style-aligned specs only
```
