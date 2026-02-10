# Ad Clicks and Impressions → SUI Contracts → Creator Payouts

## Current State

### What we track today

1. **Ad clicks** (off-chain)
   - User clicks ad → Walrus `/ads/click` (consent, ZK proof, redirect with token).
   - Click stored in **DGraph** (`AdClick`: adId, contentId, clickTokenHash, targetHash, zkProof, etc.).
   - Optional on-chain: **ad_tracking.move** has `ClickToken` and `Conversion` for verification; no payment is tied to clicks on-chain today.

2. **Ad impressions** (off-chain)
   - Sandbox/frontend sends impression to **DGraph** (`POST /impressions` with ZK proof).
   - Stored as `AdImpression` (adId, contentId, proofHash, encryptedViewer, etc.).
   - No automatic submission to SUI today.

3. **On-chain payment (contracts)**
   - **ad_campaigns.move**: `record_impression_with_escrow(campaign, escrow, pool, admin, clock)` deducts one impression from campaign budget and withdraws `campaign.bid` from escrow to **RevenuePool**.
   - **ad_payments.move**: `withdraw_for_impression` moves SUI from campaign escrow → RevenuePool. `distribute_revenue(pool, creator, foundation, pm_pool, amount, ...)` splits pool: **50% creator**, 30% foundation, 20% PM pool.
   - So **creator payouts are triggered by impressions** (one bid per impression), not by clicks. Clicks are for analytics and conversion; payment model is per-impression.

### Gap

- **No backend service** currently:
  1. Reads verified impressions (or click aggregates) from DGraph.
  2. Submits a SUI transaction to `record_impression_with_escrow` so that escrow → RevenuePool.
  3. Calls `distribute_revenue` to send pool funds to content creators (and foundation / PM).

So we **do** track ad clicks (and impressions) and we **do** have SUI contracts that can pay creators, but we **do not** yet connect the two: the “bridge” from verified tracking data to on-chain settlement is missing.

---

## Design: Bridge from Tracking to SUI Payouts

### Option A: Impression-based settlement (current contract design)

1. **Off-chain:** Impressions (and optionally clicks) are recorded in DGraph with ZK proofs; aggregates/thresholds can be used to batch.
2. **Bridge job (sui-service or cron):**
   - Query DGraph for verified impressions per campaign (e.g. `adId` = campaign ID) that are not yet “settled”.
   - For each campaign that has an on-chain `AdCampaign` + `CampaignEscrow`:
     - Build a SUI transaction that calls `record_impression_with_escrow` once per impression (or batch N impressions into N calls; the contract is 1 impression per call today).
   - Submit the transaction(s). Requires **AdminCap** (and thus the admin key) to call `withdraw_for_impression` inside the contract.
3. **Revenue distribution:**
   - RevenuePool now holds SUI from those withdrawals.
   - A separate job or endpoint:
     - Attributes pool revenue to creators (e.g. by contentId → dApp owner from sui-service).
     - Calls `distribute_revenue(pool, creator_address, foundation_address, pm_pool_address, amount, clock, admin, ctx)` to pay out.

**Env / config:** `PACKAGE_ID`, `ADMIN_CAP_OBJECT_ID`, admin key (e.g. `ADMIN_PRIVATE_KEY` or `ADMIN_KEY_B64`), `DGRAPH_SERVICE_URL` (for sui-service to read impressions), `REVENUE_POOL_OBJECT_ID`, `CLOCK_OBJECT_ID`, foundation and PM pool addresses.

### Option B: Click-based payment (contract change)

If we want creators to be paid **per click** instead of (or in addition to) per impression:

1. **Contract:** Add e.g. `record_click_with_escrow` (or a shared “record engagement”) that:
   - Takes a verified click (or a proof hash from DGraph) and campaign/escrow/pool.
   - Deducts a “click bid” from campaign escrow and moves it to RevenuePool (similar to `withdraw_for_impression` but for one click).
2. **Off-chain:** We already store clicks in DGraph; optionally verify clicks on-chain via **ad_tracking** (ClickToken / Conversion).
3. **Bridge:** Same idea as Option A, but query DGraph for verified **clicks** and submit `record_click_with_escrow` (or equivalent) instead of/in addition to impression-based calls.

Today the contracts only have **impression-based** withdrawal; click-based payment would require a new entry function and possibly a new “click bid” field on the campaign.

---

## Implementation Checklist

- [x] **Bridge: impressions → SUI**
  - [x] In sui-service: `GET /ads/settlement/impressions?campaignId=&escrowId=&limit=10` queries DGraph and submits `record_impression_with_escrow`. Env: SUI_PACKAGE_ID, ADMIN_CAP_OBJECT_ID, REVENUE_POOL_OBJECT_ID, ADMIN_PRIVATE_KEY, DGRAPH_SERVICE_URL.
  - [ ] Resolve campaign + escrow + pool + clock object IDs (from env or dynamic object lookup).
  - [ ] Build and sign `record_impression_with_escrow` with admin key + AdminCap.
  - [ ] Submit transaction(s); mark impressions as “settled” in DGraph (or in a local table) to avoid double-spend.
- [ ] **Revenue distribution**
  - [ ] Map contentId (e.g. dApp ID) → creator address (sui-service dapps: owner).
  - [ ] Compute amount per creator from settled impressions (e.g. sum of bid × count per content).
  - [ ] Call `distribute_revenue` with creator, foundation, PM pool addresses and amount.
- [ ] **Config / secrets**
  - [ ] AdminCap object ID and admin key in env (or secret manager).
  - [ ] DGRAPH_SERVICE_URL for sui-service if it reads impressions directly; or a small “settlement” service that has DGraph + SUI.
- [ ] **Optional: click-based payment**
  - [ ] Add `record_click_with_escrow` (or similar) in ad_campaigns.move / ad_payments.move.
  - [ ] Bridge: verified clicks from DGraph → on-chain click payment; then same distribute_revenue flow for creators.

---

## E2E coverage

- **Tested by:** `tests/e2e/ad-settlement.spec.ts` (GET /ads/settlement/status, GET /ads/settlement/impressions validation). With SUI and DGraph up, settlement and revenue-distribution behavior is covered by unit tests (dgraph-service: campaigns, impressions/settle) and sui-service build.

## Summary

| Item | Status |
|------|--------|
| Track ad clicks | ✅ Walrus → DGraph (and optional on-chain ad_tracking) |
| Track impressions | ✅ DGraph (and sandbox/frontend submit) |
| SUI contracts for payment | ✅ Per-impression: record_impression_with_escrow → pool; distribute_revenue → creator 50% |
| Send tracking data to SUI | ✅ Bridge: sui-service `GET /ads/settlement/impressions` (with env configured) |
| Content creators get paid | ✅ `POST /ads/revenue/distribute` pays creator 50%, foundation 30%, PM 20% from pool |

Once the bridge is in place, we **are** tracking ad clicks (and impressions) and **sending** that information to SUI (via record_impression_with_escrow and optionally future click-based entry), so content creators can get paid from the RevenuePool.
