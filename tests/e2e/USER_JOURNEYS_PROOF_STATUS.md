# User Journeys – E2E Proof Status

Which user-facing journeys have **browser E2E proof** against test.dlux.io (or testnet), and which are missing.

---

## How to redeploy test.dlux.io

Redeploy rebuilds the Vue app with `VITE_SUI_SERVICE_URL=https://sui.dlux.io` and `VITE_DGRAPH_SERVICE_URL=https://gql.dlux.io` so the Hub and detail page call the same backends.

**Option A – Webhook (push to main)**  
Push to `main`; the webhook runs `deploy-server.sh` on the server.

**Option B – Manual on server**  
SSH to the server and run:
```bash
cd /home/ubuntu/dlux-sui && ./deploy-server.sh
```

After redeploy, run the dApp+PM journey E2E:
```bash
E2E_BASE_URL=https://test.dlux.io SUI_SERVICE_URL=https://sui.dlux.io DGRAPH_SERVICE_URL=https://gql.dlux.io npx playwright test dapp-pm-journey --project=chromium
```

---

## Feature smoke tests (feature-coverage.spec.ts)

One smoke test per documented feature. Run: `E2E_BASE_URL=https://test.dlux.io npx playwright test feature-coverage --project=chromium`

Covers: Home, Hub (search, filters, PMs), dApp detail, Post dApp auth guard, Privacy, Account page, Connect wallet modal, Social feed section, Billing, Premium content, Subscribe CTA, Governance, SuiNS, Trending dApps. Skips: Hub→dApp detail and DApp detail links when no dApps in hub.

---

## Journeys with E2E proof (browser or API against test.dlux.io / testnet)

| Journey | Spec(s) | Proof type |
|--------|---------|------------|
| **dApp post → PM → Hub → Sandbox** | `dapp-pm-journey.spec.ts` | API create + browser (hub, detail, sandbox). Requires redeploy so Hub uses sui.dlux.io. |
| **Auth / Connect wallet** | `content-creation-full`, `user-journey-full` | Browser: connect modal, consent; content-creation uses wallet for /post. |
| **Browse Hub → dApp detail → Remix/Sandbox** | `user-journey-full`, `dapp-pm-journey` | Browser: hub, View, detail page, Open in Sandbox. user-journey expects "dApp details" heading; detail page now shows dApp name as h1. |
| **Subscribe (API)** | `subscription.spec.ts`, `subscription-real-sui.spec.ts` | API: create subscription, get status; real SUI on testnet. |
| **Subscribe (browser)** | `subscribe-journey-full.spec.ts` | Scaffold only: account/hub nav, subscribe CTA if present; skips when Subscribe UI not implemented. |
| **Ad campaign / ads** | `ad-journey-browser`, `ad-journey-full`, `ad-campaigns`, `ad-clicks` | Browser (ad-journey-browser) + API/full (ad-journey-full, ad-campaigns, ad-clicks). |
| **Content creation (post dApp form)** | `content-creation-full.spec.ts` | Browser: fill form, submit; does not assert hub or sandbox. |
| **Revenue / PM (browser)** | `revenue-distribution-full.spec.ts` | Hub PMs tab, PM cards; skips when no markets or no bet/claim UI. |
| **Click bundling** | `click-bundling-full.spec.ts` | Scaffold: hub/detail load; skips when ad gate not implemented. |

---

## Journeys missing or weak E2E proof

| Journey | Gap |
|--------|-----|
| **Social feed** | **No browser E2E.** `social-posts.spec.ts` is API only (sign message, POST to DGraph, get feed). Missing: open test.dlux.io → create post from HomeView → see post in feed. |
| **Premium content** | **No browser E2E.** `premium-content.spec.ts` is API only (list, access, purchase, earnings). Missing: open test.dlux.io → view premium content → pay → unlock. |
| **Billing / claim payouts** | **No browser E2E.** `billing.spec.ts` is API only (overview, claim, storage funding, verify payment). Missing: account/billing page → view overview → claim (if UI exists). |
| **Location / spots** | **No browser E2E.** `location-subscription.spec.ts` is API only (preferences, popular spots, subscribe/unsubscribe). Missing: any UI flow for location preferences or spot subscribe. |
| **Subscribe end-to-end (browser)** | **Weak proof.** `subscribe-journey-full` only checks nav and subscribe CTA if present; often skips. No browser flow: click Subscribe → pay with wallet → subscription active. |
| **Post dApp from UI → appears in Hub** | **Split proof.** `content-creation-full` posts from form but does not assert hub. `dapp-pm-journey` creates via API then asserts hub. Missing: single browser flow “submit from /post → go to Hub → see my dApp”. |
| **Governance** | **API only.** `governance.spec.ts` – no browser E2E for governance UI (if any). |

---

## Recommended next specs (to add proof)

1. **Social journey (browser)** – HomeView → create post (signed) → post appears in feed. Requires wallet connect/sign in browser.
2. **Premium purchase (browser)** – Navigate to premium content → pay (wallet or API) → content unlocked. Depends on premium UI on test.dlux.io.
3. **Billing / claim (browser)** – Account/billing page → billing overview visible → claim payouts (if UI exists).
4. **Subscribe full (browser)** – Account or creator page → Subscribe → pay (wallet) → subscription status active. Depends on Subscribe UI.
5. **Post dApp from UI → Hub (browser)** – /post → fill form → submit → redirect → /dapps → see same dApp (by name or id). Would unify content-creation and dapp-pm-journey in one flow.

---

## Quick reference

- **Run all E2E (default localhost):** `npm run test:e2e`
- **Run against test.dlux.io:** `npm run test:e2e:testnet` or env vars + `npx playwright test <spec> --project=chromium`
- **Style-aligned browser-only specs:** `npm run test:e2e:browser`
- **Redeploy:** Push to main (webhook) or `./deploy-server.sh` on server.
