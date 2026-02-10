# Architecture Cohesion: Spec → DGraph → E2E

This doc describes how the project stays cohesive: **API spec as source of truth**, **social and off-chain interactions through DGraph**, and **E2E tests that validate the spec**.

## 1. API spec as source of truth

- **Spec location:** [docs/api/README.md](api/README.md)
  - [docs/api/dgraph-openapi.yaml](api/dgraph-openapi.yaml) — DGraph service (port 3003): paths, request/response shapes.
- **SUI** (3001) and **Walrus** (3002) are documented in the [Developer Guide](developer-guide.md#-api-reference); OpenAPI for them can be added under `docs/api/` later.
- **Clients and E2E** should align with the spec: same paths, same query/body shapes. The E2E helper [tests/e2e/helpers/api-helpers.ts](../tests/e2e/helpers/api-helpers.ts) implements the DGraph (and SUI/Walrus) surface to match the spec and developer-guide.

## 2. Social and off-chain interactions run through DGraph

All of the following are served by the **DGraph service** (read/write from Dgraph or in-memory fallback):

| Domain | Path prefix | Purpose |
|--------|-------------|---------|
| **Social** | `/social` | Posts, feed, interactions (like, repost, reply). Gas-free; signed by wallet. |
| **Subscription** | `/subscription` | Platform-wide ad-free: create subscription, get status. |
| **Governance** | `/governance` | Platform variables (e.g. foundationShare, pmFundShare), governance markets. |
| **Markets** | `/markets` | Prediction markets: list (high-payout, by dApp), payouts, create/bet (return tx id; on-chain execution elsewhere). |
| **Safety** | `/safety` | dApp safety status derived from PMs. |
| **Location** | `/location` | User preferences, popular spots, subscribe/unsubscribe to spots. |
| **Campaigns / Ads** | `/campaigns`, `/impressions`, `/ads`, `/analytics` | Ad campaigns, impression recording, ad selection, analytics. |

The frontend and E2E tests call these endpoints (via `VITE_DGRAPH_SERVICE_URL` / `DGRAPH_SERVICE_URL`, e.g. `https://gql.dlux.io` in production). No separate “social service” or “PM service” — one DGraph service, one spec.

## 3. E2E tests validate the spec

- **API-spec E2E:** [tests/e2e/api-spec.spec.ts](../tests/e2e/api-spec.spec.ts) runs **DGraph flows from the spec**: health, then social (post + feed), subscription (create + status), governance (variables), markets (high-payout, payouts). This keeps “run things like social interactions through DGraph” explicit and tested.
- **Other E2E specs** use `api-helpers`, which implements the same surface as the spec. So:
  - `social-posts.spec.ts` → DGraph `/social/posts` (create, get feed).
  - `subscription.spec.ts` → DGraph `/subscription`, `/subscription/status`.
  - `governance.spec.ts` → DGraph `/governance/variables`.
  - `location-subscription.spec.ts` → DGraph `/location/*`.
  - `pm-markets.spec.ts`, `dapp-pm-journey.spec.ts` → DGraph `/markets/*`, `/safety/*`.
  - Ad/campaign specs → DGraph `/campaigns`, `/impressions`, `/ads`, `/analytics`.

Adding or changing a path in the spec should be reflected in api-helpers and in at least one E2E (api-spec or feature spec).

## 4. Flow summary

```
docs/api/dgraph-openapi.yaml  →  DGraph service (implemented)
        ↓
tests/e2e/helpers/api-helpers.ts  →  implements same paths
        ↓
tests/e2e/api-spec.spec.ts  →  runs DGraph flows (health, social, subscription, governance, markets)
tests/e2e/*.spec.ts          →  use api-helpers for API; Playwright for browser
```

This keeps the project cohesive: one spec, one service for social/off-chain, and E2E that run those interactions through DGraph and validate the contract.
