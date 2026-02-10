# Testing Style

Project direction for end-to-end (E2E) testing. Follow these conventions for all new E2E tests and when extending or refactoring existing ones.

## Core Principles

### 1. Playwright-only E2E

E2E tests use **Playwright** exclusively. All user journeys are expressed as Playwright specs—no Cypress, no Puppeteer, no custom browser automation. Playwright provides multi-browser support, reliable waits, and a single, consistent API.

### 2. Multiple user-agents

Run the **same** E2E suites across **multiple user-agents** (browsers):

- **Chromium** (Desktop Chrome)
- **Firefox** (Desktop Firefox)
- **WebKit** (Desktop Safari)

Configure via Playwright `projects`. Optionally add mobile viewports (e.g. `Mobile Chrome`, `Mobile Safari`) for responsive flows. The goal is to catch browser- and viewport-specific regressions, not to maintain separate test suites per browser.

### 3. Bundled and processed on testnet

E2E runs use a **built, bundled** frontend and services wired to a **testnet** (or local Sui validator):

- **Bundled**: Frontend is built (e.g. `npm run build` / Vite) and served as in staging.
- **Processed**: Full stack runs—frontend → wallet → RPC → indexer → DGraph, Walrus, PM, etc.
- **Testnet**: SUI network is **testnet** or **local validator**. Never run E2E against mainnet.

Contract deployment, RPC, and faucet URLs must target testnet. See `FULL_E2E_SETUP.md` and `docker-compose.testnet.yml` for configuration.

### 4. Wait-for-callback style (Playwright waits only)

Synchronize on **UI and network** via Playwright’s wait APIs only. No direct backend polling, no custom `setInterval`/`setTimeout` loops hitting services.

**Use:**

- `page.waitForSelector(...)` / `locator.waitFor()`
- `page.waitForURL(...)` / `page.waitForNavigation()`
- `page.waitForResponse(...)` when you need to assert on API calls triggered by the UI
- `expect(locator).toBeVisible()` / `toBeEnabled()` / `toHaveText()` (Playwright’s built-in waiting)
- `page.waitForLoadState('networkidle')` or `'domcontentloaded'` when appropriate

**Avoid:**

- `axios` / `fetch` / `request` from test code to backend services
- Polling backend health or data endpoints to decide when to proceed
- Custom sleep timers instead of Playwright waits

All “is it ready?” logic stays in Playwright (DOM, URL, response, or load state).

### 5. Processed through Playwright calls alone

Every user action in E2E is a **Playwright** action:

- `page.goto(url)`
- `page.click(selector)` / `locator.click()`
- `page.fill(selector, value)` / `locator.fill()`
- `page.selectOption(...)`, `page.check()`, `page.uncheck()`
- `page.press(key)`, `page.keyboard.type(...)`
- Wallet interactions via injected scripts or extension automation only as documented

Tests must **not** drive the app by calling backend APIs, importing app code, or manipulating server state directly. The browser is the only interface.

### 6. Backend strictly no-touch

**The backend is never touched directly from E2E tests.**

- No HTTP calls from test code to SUI Service, DGraph, Walrus, ZK Service, etc.
- No use of `api-helpers`, `axios`, or `fetch` against service URLs inside E2E specs that claim to follow this style.
- Backend is exercised **only** as a consequence of user actions in the browser (clicks, navigation, form submits, wallet signing, etc.).

This proves that the **frontend and in-browser flow** correctly drive the full stack. If a journey fails, the cause is in the UI, client–server contract, or network—not in test-only shortcuts.

---

## Summary

| Rule | Meaning |
|------|---------|
| **Playwright-only** | E2E = Playwright. No other E2E framework. |
| **Multiple user-agents** | Same tests run on Chromium, Firefox, WebKit (and optionally mobile). |
| **Bundled on testnet** | Built app + services vs testnet/local validator. No mainnet. |
| **Wait-for-callback** | Sync via Playwright waits only. No backend polling or custom sleep loops. |
| **Playwright calls alone** | All interaction via `page.*` / `locator.*`. No direct API usage. |
| **Backend no-touch** | No HTTP to backend from tests. Backend used only via browser. |

---

## Relation to existing tests

- **API-style E2E** (e.g. `ad-campaigns.spec.ts`, `ad-clicks.spec.ts`, `premium-content.spec.ts`) use `api-helpers` and hit services directly. They are **integration/API** tests, not aligned with this style.
- **Direction**: New E2E work should follow this style. Prefer **Playwright-only, multi–user-agent, testnet, wait-for, backend no-touch** specs. Over time, migrate or replace API-style E2E with browser-driven flows where the same coverage is needed.
- **Full E2E** (e.g. `ad-journey-full.spec.ts`) use Playwright but still call backend APIs. Align them with this style by removing direct backend calls and performing all actions through the UI.

---

## References

- [Playwright docs](https://playwright.dev/docs/intro)
- [tests/e2e/README.md](../tests/e2e/README.md) – E2E setup and commands
- [E2E Test Summary](../tests/e2e/E2E_TEST_SUMMARY.md) – Strategy and coverage
- [FULL_E2E_SETUP.md](../tests/e2e/FULL_E2E_SETUP.md) – Testnet and full E2E setup
