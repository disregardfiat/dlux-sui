# Feature Implementation Roadmap

Based on E2E test results from test.dlux.io (57 passed, 23 skipped).

## Priority 1: Core User Flows (High Impact)

### 1. Subscribe UI (Creator/Premium Tiers)
**Status:** ✅ Subscribe CTA on profiles; Profile link in hub hero  
**Tests:** `subscribe-journey-full.spec.ts` (pass: Profile link in hero → AccountView Subscribe)  
**Locations:**
- Hub hero: "Profile" link → /@sui_artist (creator profile)
- AccountView: "Subscribe for ad-free" button + modal
- Allow creators to set their own tiers for subscriptions
- These subscriptions are like patreon, they go 90% to the creator and 10% to the foundation
- Is there a way to unlock walrus seal content for subscriptions? or tiered, like sub+ gets all, sub- get's all content a week old... 

**Implementation:**
- [x] Add Subscribe CTA to creator profiles (AccountView)
- [x] Profile link in hub so tests can reach creator profile
- [x] Build tier selection modal (monthly/annual)
- [x] Integrate wallet payment flow
- [x] Show subscription status in account settings
- [x] Display subscriber count for creators

**Files:** `DAppsView.vue` (Profile link), `AccountView.vue` (Subscribe button/modal)

---

### 2. Ad Gate/Overlay for dApp Views
**Status:** ✅ Implemented (basic overlay with Skip/Continue)  
**Tests:** `ad-journey-browser.spec.ts`, `click-bundling-full.spec.ts` (pass when dApps in hub)  
**Locations:**
- dApp detail page (before "Open in Sandbox")
- Sandbox iframe wrapper

**Implementation:**
- [x] Create ad overlay component (Skip/Continue, optional countdown)
- [x] Integrate with ad-campaigns API (select ad for placement)
- [x] Track impressions and clicks
- [x] Add "Skip" option for subscribers
- [ ] Respect user ad consent preferences

**Files:** `AdOverlay.vue`, `DAppDetailView.vue`

---

### 3. PM Bet/Claim UI (Prediction Markets)
**Status:** ✅ Place Bet / Claim buttons on PM cards (modal not wired yet)  
**Tests:** `revenue-distribution-full.spec.ts` (pass when PM markets exist)  
**Locations:**
- Hub → PMs tab (shows markets, bet/claim buttons present)
- dApp detail page (show market odds, place bet)
- dApp card in hub or profile view should have a simple indicator for PM status (time remaining, volume, ad share, and most important the cost of a true bet(90 cents to buy $1 if it succeeds)) that brings up a bet modal when clicked
- The PM needs to display full dApp metadata as well as the blobIDs of all walrus content

**Implementation:**
- [x] Add "Place Bet" button to PM cards
- [x] Build bet modal (Safe/Unsafe, amount input)
- [x] Show user's current positions
- [x] Add "Claim Winnings" button when market resolves
- [x] Display odds and pool sizes
- [x] DApp card PM indicators (time remaining, volume, cost of true bet)

**Files:** `DAppsView.vue` (PM cards); `PMBetModal.vue` (future)

---

### 4. Post dApp from UI → Appears in Hub
**Status:** ✅ Implemented  
**Tests:** `content-creation-full.spec.ts`, `dapp-pm-journey.spec.ts`  
**Locations:**
- `/post` page → submit → redirect to `/dapps?posted=1&dappId=...`
- Hub shows success banner with "View your dApp" link
- The metadata should build a preview dApp card near the post button for user confirmation

**Implementation:**
- [x] After successful POST, redirect to hub with success message
- [x] Add "View My dApp" link in success state
- [x] Refresh hub list after post (or optimistic update)
- [x] Show posting fee and PM creation confirmation
- [x] Preview dApp card in post form for user confirmation

**Files:** `PostDAppView.vue`, `DAppsView.vue`

---

## Priority 2: Social & Content (Medium Impact)

### 5. Social Feed (HomeView Posts)
**Status:** ✅ Implemented  
**Tests:** `social-posts.spec.ts` (API only, no browser E2E)  
**Locations:**
- HomeView: Feed of posts from followed creators
- Create post UI (text, images, sign with wallet)

**Implementation:**
- [x] Add "Create Post" form to HomeView
- [x] Integrate wallet signing for post authentication
- [x] Display feed of posts (infinite scroll)
- [x] Add like/comment interactions (including reply threads)
- [x] Show post author with link to profile
- [x] Follow/unfollow from profile pages

**Files to create/modify:**
- `frontend/vue-app/src/components/PostComposer.vue` (new)
- `frontend/vue-app/src/components/PostCard.vue` (new)
- `frontend/vue-app/src/views/HomeView.vue` (add feed section)

---

### 6. Premium Content Purchase Flow
**Status:** ✅ Implemented  
**Tests:** `premium-content.spec.ts` (API only, no browser E2E)  
**Locations:**
- Content detail page: "Unlock Premium" button
- Payment modal (wallet or SUI transfer)
- Access granted state

**Implementation:**
- [x] Add premium content markers (lock icon, price)
- [x] Build unlock/purchase modal
- [x] Integrate wallet payment
- [x] Show unlocked content after purchase
- [x] Display user's purchased content in account

**Files to create/modify:**
- `frontend/vue-app/src/components/PremiumUnlockModal.vue` (new)
- `frontend/vue-app/src/views/ContentDetailView.vue` (new)
- `frontend/vue-app/src/views/AccountView.vue` (add purchases tab)

---

### 7. Billing / Claim Payouts UI
**Status:** ✅ Implemented  
**Tests:** `billing.spec.ts` (API only, no browser E2E)  
**Locations:**
- Account → Billing tab
- Show payout buckets (adShare, pmShare, subscriptions)
- Claim button

**Implementation:**
- [x] Add Billing tab to AccountView
- [x] Display payout overview (total, by bucket)
- [x] Add "Claim Payouts" button
- [x] Show transaction history
- [x] Display storage funding status for dApps

**Files to modify:**
- `frontend/vue-app/src/views/AccountView.vue` (add billing tab)
- `frontend/vue-app/src/components/BillingOverview.vue` (new)

---

## Priority 3: Advanced Features (Lower Impact)

### 8. Location / Spots Subscription
**Status:** API exists, UI missing  
**Tests:** `location-subscription.spec.ts` (API only, no browser E2E)  
**Locations:**
- Map view with popular spots
- Subscribe to location updates

**Implementation:**
- [ ] Build map view component (Leaflet/Mapbox)
- [ ] Show popular spots with subscriber counts
- [ ] Add subscribe/unsubscribe buttons
- [ ] Display user's subscribed locations in account

**Files to create/modify:**
- `frontend/vue-app/src/views/MapView.vue` (new)
- `frontend/vue-app/src/components/LocationCard.vue` (new)

---

### 9. Governance UI
**Status:** ✅ Implemented  
**Tests:** `governance.spec.ts` (API only, no browser E2E)  
**Locations:**
- Governance page: proposals, voting (`/governance` route)
- Create proposal form

**Implementation:**
- [x] List active proposals
- [x] Vote UI (approve/reject)
- [x] Create proposal form (title, description, options)
- [x] Show voting results and quorum
- [x] Display platform variables (foundationShare, pmFundShare, etc.)

**Files created/modified:**
- `frontend/vue-app/src/views/GovernanceView.vue` (new)
- `frontend/vue-app/src/router/index.ts` (added `/governance` route)
- `frontend/vue-app/src/App.vue` (added Governance nav link)

---

## Go-Live Sprint: Critical Infrastructure

### ZK Proof Verification (On-Chain)
**Status:** 🔴 Placeholder - Must implement before production  
**Priority:** CRITICAL  
**Location:** `contracts/metadata_pm/sources/metadata_pm.move`

**Current State:**
- `verify_ad_view()` is a placeholder that accepts any non-empty proof
- No actual cryptographic verification of ZK proofs
- Merkle proof verification ✅ IMPLEMENTED
- Token transfers ✅ IMPLEMENTED

**Required:**
- [ ] Integrate Groth16 or equivalent ZK verifier contract
- [ ] Replace placeholder with actual proof verification
- [ ] Verify public signals match expected values
- [ ] Add on-chain verifier dependency to Move.toml

**Blocking:** Production deployment of ad network

---

## Priority 4: Privacy & Anonymous Spend (R&D)

### 12. Credits-based anonymous send package
**Status:** Planned (design in docs)  
**Goal:** Let users buy a package of credits once, then spend them **anonymously** for subscription, premium (Seal key), or other features—so “who spent what for what” is not visible on the public chain.

**Concept:**
- **Buy:** User purchases a credits package (one on-chain or off-ramp transaction). Optionally this can be the only linkable step.
- **Spend:** User spends credits from the pool via homomorphic signatures + bundles (see [docs/sui-privacy-and-payments.md](docs/sui-privacy-and-payments.md)): authorizations are aggregated off-chain, pool submits batch payouts; chain sees pool in/out, not individual “Alice → subscription.”
- **Redeem for:** Subscription (ad-free), premium content (Seal decryption key), feature access, or other entitlements—all without exposing which account spent which credits on which product.

**Implementation (high level):**
- [ ] Design pool contract (Move): accept deposits/credits, pay out to subscription/premium/entitlement providers when batch authorization is verified.
- [ ] Off-chain aggregator: collect homomorphic (or ZK) authorizations, combine, submit bundle(s) from pool.
- [ ] On-chain verification: ZK proof (or homomorphic sig verification) that batch of redemptions is valid; contract only checks proof + updates entitlements.
- [ ] Product packaging: “Buy X credits → use for subscription, Seal keys, features” with anonymous spend.
- [ ] UX: wallet flow to buy credits; separate flow to “spend credits” (e.g. choose subscription / unlock content) without linking to wallet on-chain.

**References:**
- [docs/sui-privacy-and-payments.md](docs/sui-privacy-and-payments.md) — “Can we use homomorphic signatures and bundles to hide who spent what for what?”
- Ad verification (ZK + homomorphic) — existing building block for privacy-preserving aggregation.

---

## Infrastructure Improvements

### 10. Persistent dApp Storage
**Status:** In-memory only (lost on restart)  
**Tests:** `dapp-pm-journey.spec.ts` (sandbox link missing after deploy)  
**Issue:** Test dApps created via API don't persist across service restarts

**Implementation:**
- [ ] Replace in-memory dApp repository with persistent storage (PostgreSQL/DGraph)
- [ ] Add database migrations for dApp schema
- [ ] Update sui-service to use persistent repo

**Files to modify:**
- `services/sui-service/src/repositories/dapp-repository.ts`
- Add database schema and migrations

---

### 11. Wallet Extension Integration
**Status:** Mock only  
**Tests:** `content-creation-full.spec.ts` (skips when no wallet)  
**Issue:** Browser tests can't authenticate without wallet extension

**Implementation:**
- [ ] Add Playwright wallet extension support (SUI Wallet)
- [ ] Create test wallet fixtures
- [ ] Enable full browser E2E for authenticated flows

**Files to create:**
- `tests/e2e/fixtures/wallet-extension.ts` (new)
- Update test helpers for wallet signing

---

## Quick Wins (Easy Implementations)

1. **Add "Open in Sandbox" link persistence** - Ensure owner/permlink always returned by API
2. ~~**PM market display** - Show odds and pool on detail page~~ ✅ Done (full PM bet modal + indicators)
3. ~~**Subscribe CTA placeholder** - Add "Subscribe (Coming Soon)" button to profiles~~ ✅ Done (full subscribe flow with wallet payment)
4. ~~**Ad overlay placeholder** - Show "Ad-supported content" message (no actual ads yet)~~ ✅ Done (integrated with ad-campaigns API)
5. ~~**Success redirects** - After posting dApp, redirect to hub with success message~~ ✅ Done (with auto-refresh)

---

## Testing Strategy

For each feature:
1. **API E2E first** - Ensure backend endpoints work (already done for most)
2. **Browser E2E** - Add Playwright tests for UI flows
3. **Update USER_JOURNEYS_PROOF_STATUS.md** - Mark as "browser E2E proof"

---

## Current Test Coverage

- ✅ **57 passed** (Chromium against test.dlux.io)
- ⏭️ **23 skipped** (features not implemented)
- ❌ **0 failed**

**Goal:** Reduce skipped tests to 0 by implementing missing UI features.
