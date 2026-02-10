# E2E Coverage vs Docs & API

How many journeys are still untested, and how well do tests cover `docs/` and the API surface (developer-guide + service routes).

---

## 1. E2E journeys still NOT tested (or weak)

### Count: **7 journeys** without real browser E2E proof

| # | Journey | Current coverage | Gap |
|---|--------|------------------|-----|
| 1 | **Social feed (create post in browser)** | `social-posts.spec.ts` API only (sign, POST, get feed) | No browser: HomeView → New post modal → post → see in feed |
| 2 | **Premium content (pay → unlock)** | `premium-content.spec.ts` API only | No browser: view premium → pay (wallet) → content unlocked |
| 3 | **Billing / claim payouts** | `billing.spec.ts` API only | No browser: account/billing → overview → open claim modal → confirm claim |
| 4 | **Location / spots** | `location-subscription.spec.ts` API only; many tests skipped (routes not deployed) | No browser: open Location modal → set preferences / subscribe to spot |
| 5 | **Subscribe end-to-end (browser)** | `subscribe-journey-full` scaffold only; often skips | No full flow: Subscribe modal → tier → Connect & Pay → subscription active |
| 6 | **Post dApp from UI → appears in Hub** | Split: content-creation posts form; dapp-pm-journey creates via API then asserts hub | No single browser flow: /post → submit → redirect → /dapps → see my dApp |
| 7 | **Governance (browser)** | `governance.spec.ts` API only | No browser: open Governance modal → see variables (or vote when implemented) |

### Additional gaps (partial / conditional)

- **PM Place Bet / Claim in browser**: PM cards and modals exist; `revenue-distribution-full` and `dapp-pm-journey` have placeholders but skip when no markets or no UI. No full flow: open PM Bet modal → place bet → (later) claim winnings.
- **Ad gate / click bundling**: `click-bundling-full` skips when no dApps or no ad gate. No full flow: see ad gate → click → redemption path asserted.
- Many specs use **test.skip()** (60 skips across 18 files), so documented flows exist but are not exercised in CI (e.g. location, governance, premium earnings, verify payment against live testnet, full ad-journey-full with on-chain campaign).

---

## 2. How well tests cover the docs

Docs that describe **user journeys** or **features** and the corresponding test coverage:

| Doc | Content | E2E coverage |
|-----|--------|----------------|
| **ad-network-journeys.md** | Ad journey, content creation, user journey, subscribe, click bundling, revenue distribution | **Partial.** ad-journey-browser, ad-journey-full, ad-campaigns, ad-clicks, click-bundling-full, revenue-distribution-full exist; many steps are API-only or skipped (on-chain, no campaign). |
| **pm-user-journeys.md** | PM entry (bet), monitoring, resolution, exit (claim), PM creation | **Partial.** pm-markets (API), dapp-pm-journey (API create + browser hub/detail/sandbox), revenue-distribution-full (PMs tab, bet/claim CTAs); no full browser bet/claim flow. |
| **social-dapp-journeys.md** | Reviews, comments, feedback, discovery, engagement | **Weak.** social-posts (API: create post, get feed). No browser for reviews, comments, likes, reposts, discovery. |
| **premium-content.md** | Seal flow, create/list/purchase/access, API endpoints | **API only.** premium-content.spec.ts; no browser create/preview/pay/unlock. |
| **subscription-foundation-model.md** | Platform subscription, revenue split, ad-share pool | **Partial.** subscription.spec.ts, subscription-real-sui.spec.ts (API); subscribe-journey-full (scaffold). No full browser subscribe → pay → active. |
| **moderation-system.md** | Safety, PMs, flags | **Indirect.** Covered via PM/safety APIs and dapp-pm-journey; no dedicated moderation journey test. |
| **developer-guide.md** | Quick start, auth, dApp dev, premium, ads, **API reference** | **Mixed.** Auth and dApp flows partly covered by content-creation-full, user-journey-full; API reference coverage see section 3. |
| **contracts/*.md** (ad-campaigns, ad-payments, ad-tracking, revenue-distribution, etc.) | On-chain and service APIs | **Partial.** ad-journey-full and sui-service routes hit some contract flows when not skipped; no systematic contract-API matrix. |
| **system-reference.md** | Ports, domains, URL formats | **Not tested as doc.** E2E use env vars (e.g. test.dlux.io, sui.dlux.io); no spec that asserts system-reference table. |
| **test-environment.md**, **testing-style.md** | Test setup and style | **Meta:** describe how to run tests; not “feature” coverage. |

**Summary:** Journey docs (ad, PM, social, premium, subscription) are at best **partially** covered; social and premium have the largest gaps. Contract and system-reference docs are not systematically mapped to tests.

---

## 3. How well tests cover the API (developer-guide + services)

There is **no OpenAPI/spec file**; the “API spec” is the **Developer Guide API reference** (ports 3001, 3002, 3003) and the **actual service routes** (~130 route registrations across sui, dgraph, walrus, etc.).

### SUI Service (3001) – developer-guide

| Area | Endpoints (from developer-guide) | E2E coverage |
|------|----------------------------------|--------------|
| User / SuiNS | GET/PUT profile, register-intent, availability | Used by content-creation, dapp-pm-journey, account flows; no dedicated API-only spec. |
| dApps | POST/GET dapps, owner, lookup, install | dapp-pm-journey, user-journey-full, content-creation-full hit create/get; install covered indirectly. |
| Auth | challenge, zk-login, zk-link, profile | content-creation-full, wallet login; no standalone auth API spec. |
| Billing | overview, claim, verify-payment, verify-premium-payment | **billing.spec.ts** (API); verify steps skipped against live testnet. |

### DGraph Service (3003) – developer-guide

| Area | Endpoints | E2E coverage |
|------|-----------|--------------|
| Social | posts, interactions, user stats | **social-posts.spec.ts** (create post, get feed); no browser. |
| Ad tracking | impressions, clicks, conversions, revenue | ad-campaigns, ad-clicks, ad-journey-full (when not skipped). |
| Markets | create market, bets, status, resolve, high-payout, fees, payouts | pm-markets (skipped when DGraph unavailable), dapp-pm-journey, revenue-distribution-full. |
| Governance | variables, markets, bet | **governance.spec.ts** (many tests skipped if routes not deployed). |
| Subscription | create, status | subscription.spec.ts, subscription-real-sui.spec.ts. |
| Location | preferences, spots, subscribe/unsubscribe | **location-subscription.spec.ts** (many skips when routes not deployed). |

### Walrus Service (3002) – developer-guide

| Area | Endpoints | E2E coverage |
|------|-----------|--------------|
| Blobs | upload, get, info, billing, list, delete | Used by dApp upload and premium; no dedicated blob API spec. |
| Premium | content, list, purchase, access, purchases, earnings, delete | **premium-content.spec.ts** (API); earnings test skipped if endpoint missing. |
| Ad gateway | click, convert, consent | ad-clicks, consent in login flow. |

**Summary:**  
- **Well covered by API-style specs:** Billing (overview, claim, storage), subscription (create, status), social (create post, feed), ad campaigns/clicks/impressions (when not skipped), premium (list, access, purchase, purchases; earnings skipped).  
- **Weak or skipped:** Governance, location (routes often not deployed), payment verification against live testnet, PM markets when DGraph unavailable, and **no browser E2E** for any of the “missing journeys” in section 1.

---

## 4. Feature smoke coverage (feature-coverage.spec.ts)

One smoke test per documented feature. Runs on standard Playwright projects (Chromium, Firefox, WebKit) without Slush. Validates that each feature loads and key UI elements are visible.

| Feature | Test |
|---------|------|
| Home (hero, nav, hub link) | ✓ |
| Hub (search, filter tabs, PMs) | ✓ |
| Hub → dApp detail (when dApps exist) | ✓ skip when empty |
| Post dApp (auth guard) | ✓ |
| Privacy page | ✓ |
| Account page (profile structure) | ✓ |
| Connect wallet modal | ✓ |
| Social feed section | ✓ |
| Billing (account sections) | ✓ |
| Premium content (Walrus Seal) | ✓ |
| Subscribe CTA | ✓ |
| Governance (link/modal when present) | ✓ |
| SuiNS registration section | ✓ |
| Prediction Markets (PMs tab) | ✓ |
| Trending dApps | ✓ |
| DApp detail (Back to Hub, Remix) | ✓ skip when no dApps |

Run: `E2E_BASE_URL=https://test.dlux.io npx playwright test feature-coverage --project=chromium`

---

## 5. Quick counts

| Metric | Value |
|--------|--------|
| E2E journey specs (browser or API) | 19 spec files (incl. feature-coverage) |
| **Journeys with no real browser E2E** | **7** (social, premium, billing/claim, location, subscribe full, post→hub, governance) |
| test.skip / .skip() occurrences | 60 across 18 files |
| Docs describing user journeys | 6+ (ad, PM, social, premium, subscription, moderation) |
| Docs with **no** or **weak** journey-level E2E | Social, premium, subscription (full flow), governance |
| Developer-guide API areas | 3 services × multiple areas |
| API areas with **no** or **skipped** E2E | Governance, location, verify-payment (live), premium earnings, PM when GQL down |

---

## 6. Recommended next steps

1. **Add browser E2E for the 7 missing journeys** (see USER_JOURNEYS_PROOF_STATUS.md): social post, premium purchase, billing/claim, location prefs, subscribe full, post→hub, governance modal.
2. **Reduce skips:** Either implement or deploy the missing routes (location, governance) or document which env (e.g. full testnet + DGraph) is required for each spec.
3. **Docs ↔ tests alignment:** Add a short “Tested by” line in each journey doc (e.g. “Tested by: social-posts.spec.ts (API); browser: not yet”) so coverage is explicit.
4. **API reference vs tests:** Optionally add an API-only smoke spec per service (sui, dgraph, walrus) that hits each developer-guide endpoint once, to catch regressions and document coverage.
