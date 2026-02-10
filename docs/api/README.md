# API Specification

The API is defined as the **single source of truth** for service contracts. E2E tests and clients (e.g. `tests/e2e/helpers/api-helpers.ts`) should align with these specs.

## Specs

| Spec | Service | Description |
|------|---------|-------------|
| [dgraph-openapi.yaml](./dgraph-openapi.yaml) | DGraph (port 3003) | Social, markets, governance, subscription, location, campaigns, impressions, ads, safety. **All off-chain / social interactions run through DGraph.** |

SUI service (3001) and Walrus (3002) are documented in [Developer Guide](../developer-guide.md#-api-reference). OpenAPI for those can be added here later.

## Cohesion

- **API spec** → defines paths, request/response shapes, and which service owns what.
- **DGraph** → runs social (posts, interactions, feed), prediction markets (list, bets, payouts), governance variables, subscription status, location preferences/spots, ad campaigns/impressions/analytics.
- **E2E tests** → validate the spec: `tests/e2e/api-spec.spec.ts` runs DGraph flows from the spec; other E2E specs use `api-helpers` which implements the same surface.

See [Architecture cohesion](../architecture-cohesion.md) for the full picture.
