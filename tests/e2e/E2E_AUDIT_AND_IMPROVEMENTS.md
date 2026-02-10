# E2E Test Audit and Improvement Suggestions

Audit of the E2E test suite to capture underlying weaknesses and suggest concrete improvements.

---

## 1. Weaknesses identified

### 1.1 Prolific use of `test.skip()` (61 skips across 18 files)

- **Risk:** Large portions of the suite never run in CI; regressions in skipped paths go unnoticed.
- **Examples:**
  - Whole-file or whole-suite skips with no message or generic “service not available” (e.g. `subscription.spec.ts`, `social-posts.spec.ts`, `ad-campaigns.spec.ts`, `governance.spec.ts`, `location-subscription.spec.ts`, `premium-content.spec.ts`, `pm-markets.spec.ts`, `ad-clicks.spec.ts`).
  - Conditional skips: “No dApps in hub”, “No profile link”, “Ad gate not implemented”, “Open in Sandbox link missing”, “Location/Governance routes not deployed”, “Verify payment uses fake txId”.
- **Underlying cause:** Tests depend on environment (services up, routes deployed, seeded data, deploy config) and UI state that is not guaranteed. Skip becomes the default instead of failing fast or being gated by a clear “required env” check.

**Improvement:**  
- Replace silent `test.skip()` with `test.skip(true, 'reason')` and document the reason (e.g. “Requires DGRAPH_SERVICE_URL and location routes deployed”).  
- Introduce a **required-env / capability check** at the start of each spec (or a shared fixture): if the required service/route is missing, skip the whole describe with one clear message; otherwise run all tests and **fail** instead of skipping mid-flow.  
- Add a **CI matrix** or tags (e.g. `@api`, `@browser`, `@requires-dgraph`, `@requires-seed`) so CI can run “always-on” specs vs “full stack” specs separately.  
- Track skip reasons in a single place (e.g. `tests/e2e/SKIP_REASONS.md` or a table in this doc) and treat each as a backlog item: either fix the dependency or remove the test.

---

### 1.2 Style drift: API vs browser-only (backend no-touch)

- **Docs (testing-style.md):** E2E should be Playwright-only, backend no-touch; API-style specs are “integration/API” and not aligned.
- **Reality:** Many specs still call `apiClient` (api-helpers) to create data or check health. Examples: `dapp-pm-journey.spec.ts` (create dApp via API, then browser); `ad-campaigns.spec.ts`, `ad-clicks.spec.ts`, `billing.spec.ts`, `subscription.spec.ts`, etc. (fully API-driven).
- **Risk:** Two different contracts: “E2E” that touches backend vs “browser E2E” that doesn’t. Confusion about what is actually tested (UI vs API), and API-only specs can pass while the real user path is broken.

**Improvement:**  
- **Tag and document** two categories explicitly:
  - **API / integration:** `api-spec.spec.ts`, `ad-campaigns`, `ad-clicks`, `billing`, `subscription`, `governance`, `location-subscription`, `premium-content`, `pm-markets`, `social-posts`. These are “API contract” tests; keep them but name/label them (e.g. `@api` or `integration/` folder) and run in a separate job if desired.
  - **Browser E2E (style-aligned):** `user-journey-full`, `content-creation-full`, `ad-journey-browser`, `click-bundling-full`, `subscribe-journey-full`, `revenue-distribution-full`, `dapp-pm-journey` (browser steps only). For these, **remove or isolate** any backend calls: e.g. move “create dApp” in dapp-pm-journey to a **setup script or fixture** that runs once (and is clearly “test harness”), or replace with a browser flow (post dApp from /post) so the spec is 100% browser.  
- Add a short **“Testing strategy”** section in README: “API specs validate docs/api and services; browser E2E validate UI journeys and must not call backend from test code.”

---

### 1.3 No cleanup / teardown (state leakage)

- **Observation:** Most API-style specs create data (campaigns, dApps, subscriptions, posts) but do not delete or revert it. Only `ad-journey-full.spec.ts` has `afterAll` that cancels the campaign.
- **Risk:** Shared environments (e.g. test.dlux.io or a shared DGraph) accumulate test data; flakiness or cross-test interference when tests assume “empty” or “first campaign”. Billing “claim” actually performs a claim and can affect balances.

**Improvement:**  
- For **API/integration** specs that create entities: add `afterAll` (or `test.afterAll`) to delete/cancel/revoke created resources where the backend supports it (e.g. cancel campaign, delete test post by id).  
- For **billing**: either use a dedicated test wallet and mock “no balance” or document that claim tests mutate state and should run in an isolated env.  
- Consider **test prefixes** for all created data (e.g. `E2E-` in names) and a periodic job or script to purge old E2E data.

---

### 1.4 Use of `page.waitForTimeout` (fixed sleeps)

- **Location:** `user-journey-full.spec.ts` (300ms), `dapp-pm-journey.spec.ts` (500ms, 1500ms, 500ms).
- **Risk:** Flakiness on slow CI or slow app; unnecessary delay when the app is fast. Violates testing-style “wait-for-callback” (use Playwright waits only).

**Improvement:**  
- Replace with **state-based waits:** e.g. `await expect(sandboxLink).toBeVisible()` (already used elsewhere), or `page.waitForLoadState('networkidle')` / wait for a specific selector or response. Remove or minimize any `waitForTimeout`; if something is only “wait for animation”, use a short `expect(locator).toBeVisible()` or similar.

---

### 1.5 Data and environment assumptions

- **“No dApps in hub”:** Browser specs skip when there are no dApps. Hub list comes from SUI service; if the env has no dApps, every such test skips.
- **“No PM markets”, “No profile link”:** Same idea: tests assume pre-seeded or pre-existing data.
- **Deploy config:** dapp-pm-journey and others assume `VITE_SUI_SERVICE_URL` (and sometimes `VITE_DGRAPH_SERVICE_URL`) are set correctly on the deployed frontend; otherwise “Open in Sandbox” or detail page fails and tests skip.

**Improvement:**  
- **Seed strategy:** Document and, where possible, automate a minimal seed for E2E: e.g. one dApp, one PM market, one profile. Options: (a) a `tests/e2e/scripts/seed-for-e2e.ts` (or bash) that calls API to create one dApp + optional market; (b) a fixture or `beforeAll` in a single “setup” spec that creates seed data and stores ids in a file or env for other specs; (c) run seed as part of CI before browser E2E.  
- **Env checklist:** Add `tests/e2e/ENV_CHECKLIST.md` or a table: for each spec (or tag), list required env vars and required state (e.g. “DGRAPH_SERVICE_URL, at least one dApp in hub”).  
- **Deploy contract:** In docs or CI, state clearly: “Browser E2E against test.dlux.io require frontend built with VITE_SUI_SERVICE_URL=https://sui.dlux.io (and VITE_DGRAPH_SERVICE_URL=https://gql.dlux.io).”

---

### 1.6 Fragile selectors and copy-dependent assertions

- **Examples:** `.result-card`, `.dapp-detail`, `.modal-title`, “View”, “Back to Hub”, “Open in Sandbox”, “dApp details”, “Place Bet”, “Claim”.  
- **Risk:** UI copy or class changes break tests; selectors are not centralized, so the same concept is located in multiple ways across specs.

**Improvement:**  
- Prefer **role-based and accessible selectors:** `getByRole('link', { name: /view/i })`, `getByRole('button', { name: /place bet/i })`, and add `data-testid` only where necessary (e.g. `data-testid="ad-gate"` already used).  
- **Shared selectors/constants:** Consider a small `tests/e2e/helpers/selectors.ts` or `constants.ts` (e.g. `HUBS_VIEW_LINK = /view/i`, `DAPP_DETAIL_HEADING = /dapp details/i`) so one change updates all specs.  
- Document a **convention:** “E2E must use getByRole/getByLabel where possible; add data-testid for dynamic or repeated elements.”

---

### 1.7 Inconsistent health checks and skip behavior

- **Pattern:** Many specs use `beforeAll` to check service health and then call `test.skip()` (sometimes without a message). In Playwright, `test.skip()` in `beforeAll` may not skip all tests in the describe in a predictable way; some specs also have per-test skips.
- **Risk:** Unclear which tests run under which conditions; some tests may run when the service is down and fail with a confusing error.

**Improvement:**  
- **Single skip point:** In each spec that depends on a service, do one thing in `beforeAll`: e.g. set a `workerStorageState` or a module-level `let servicesOk = false`, then run the health check and set `servicesOk = true` only if all required services are up. In each test, start with `if (!servicesOk) test.skip(true, 'Required services not available (see ENV_CHECKLIST)');`. Alternatively use a **fixture** that skips the test when the service is down.  
- Use **descriptive skip messages** everywhere (e.g. “DGraph not available (DGRAPH_SERVICE_URL)” or “Location routes not deployed on dgraph-service”) so logs and reports are actionable.

---

### 1.8 Timeouts and CI behavior

- **Config:** `timeout: 15000`, `expect: { timeout: 5000 }`; some tests override with 8000 or 30000.  
- **Risk:** Slow operations (wallet, RPC, DGraph) can cause random failures under load; no distinction between “slow” and “stuck”.

**Improvement:**  
- Keep global timeouts modest; for known-slow operations (e.g. wallet sign, tx confirmation), use a **per-test or per-locator** timeout and a clear assertion (e.g. “wait for tx digest”) rather than a single large test timeout.  
- In CI, consider **retries: 1** for browser E2E only (already `retries: process.env.CI ? 2 : 0`) and ensure trace is collected on retry so failures are debuggable.

---

### 1.9 Missing coverage (recap from COVERAGE_VS_DOCS_AND_API)

- **7 journeys** with no real browser E2E: social (create post in browser), premium (pay → unlock), billing/claim (modal flow), location (prefs/spots), subscribe (full flow), post dApp → Hub (single flow), governance (modal).  
- **API specs** for location and governance are mostly skipped when routes are not deployed; payment verification is skipped against live testnet.

**Improvement:**  
- Prioritize **one or two** high-value browser flows (e.g. “post from UI → appears in Hub”, “billing page → claim modal”) and add them as new specs or extend existing ones, even if initially behind a tag or optional env.  
- For **location and governance**: either deploy the routes in test env and enable the tests, or move them to a “optional/routes-required” suite and document that.

---

## 2. Suggested improvements (prioritized)

| Priority | Improvement | Effort | Impact |
|----------|-------------|--------|--------|
| P1 | Replace all silent or vague `test.skip()` with `test.skip(true, 'reason')` and add a short SKIP_REASONS or table in this doc | Low | Clear reporting and backlog |
| P1 | Remove or replace `page.waitForTimeout` with state-based waits (expect visible, waitForResponse, etc.) | Low | Less flakiness, style compliance |
| P1 | Tag API vs browser specs (e.g. `@api` / `@browser`) and document in README + possibly split npm scripts / CI jobs | Low | Clear contract and CI strategy |
| P2 | Add teardown (afterAll) for API specs that create campaigns, dApps, subscriptions, or posts where backend allows delete/cancel | Medium | No state leakage, stable shared env |
| P2 | Introduce a single “required env” / capability check per spec (or fixture) and skip entire describe with one message when not met | Medium | Predictable skips, fewer mid-test skips |
| P2 | Add minimal E2E seed (one dApp, optional PM) via script or fixture and document in ENV_CHECKLIST | Medium | Fewer “No dApps in hub” skips |
| P2 | Centralize selectors/constants (roles, copy, data-testid) in a small helper | Low–Medium | Easier UI changes, consistent selectors |
| P3 | Add one or two full browser journeys (e.g. post → Hub, billing claim modal) | Medium | Closes largest coverage gaps |
| P3 | Consider Playwright fixtures for “logged-in user” and “service availability” to reduce repeated beforeAll/skip logic | Medium | DRY, consistent skip behavior |
| P3 | Document deploy contract (VITE_* for test.dlux.io) in test-environment or README and enforce in CI if possible | Low | Fewer “Open in Sandbox missing” skips |

---

## 3. Quick wins (can do immediately)

1. **Skip messages:** Grep for `test\.skip\(\)` (no args) and replace with `test.skip(true, 'reason')` in: `billing.spec.ts`, `subscription.spec.ts`, `social-posts.spec.ts`, `ad-campaigns.spec.ts`, `ad-clicks.spec.ts`, `premium-content.spec.ts`, `governance.spec.ts`, `location-subscription.spec.ts`, `pm-markets.spec.ts`. **Done.**
2. **waitForTimeout:** In `user-journey-full.spec.ts` and `dapp-pm-journey.spec.ts`, replace each `page.waitForTimeout(n)` with state-based waits. **Done.**
3. **README:** Add a subsection “API specs vs browser E2E” and list which files are API-driven vs browser-only; add one line on “required env” and link to this audit. **Done.** See [README.md](./README.md#api-specs-vs-browser-e2e).

**Coverage percentages:** See [COVERAGE_PERCENTAGES.md](./COVERAGE_PERCENTAGES.md) for % of documented features and API that have tests vs that have passing tests.

---

## 4. Summary

| Weakness | Root cause | Main improvement |
|----------|------------|-------------------|
| 61 skips | Env/data dependency; skip used instead of fail or explicit gate | Explicit skip reasons; required-env check; seed strategy; tags |
| Style drift | Mixed API and browser specs under “E2E” | Tag and document API vs browser; move toward backend no-touch for browser specs |
| No teardown | No afterAll cleanup | Add afterAll delete/cancel where backend supports it |
| waitForTimeout | Legacy or quick fix | Replace with state-based Playwright waits |
| Data assumptions | No seed, shared env | Seed script/fixture; ENV_CHECKLIST; deploy contract doc |
| Selectors | Ad-hoc, copy-dependent | Prefer roles; optional shared selectors/constants |
| Health/skip logic | Inconsistent beforeAll + per-test skip | Single capability check or fixture; clear skip messages |
| Coverage gaps | Missing browser journeys | Prioritize 1–2 full flows (post→Hub, billing claim) |

Implementing the P1 and “Quick wins” items will improve clarity, stability, and alignment with the testing style without large refactors; P2/P3 will reduce skips and state leakage and close the main coverage gaps.
