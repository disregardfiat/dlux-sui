# Developer Quick Reference

Quick reference guide for common development tasks and workflows.

## Quick Start

```bash
# Install all dependencies
npm install

# Option A (recommended): start infra/services with Docker
npm run docker:up

# Option B: run workspace dev scripts directly
npm run dev

# Or start individual services
cd services/sui-service && npm run dev
```

## Common Tasks

### Docker

```bash
npm run docker:build
npm run docker:up
npm run docker:down
```

### Testing

```bash
# Run all tests
npm test

# Run tests for specific service
cd services/sui-service && npm test
```

### Code Quality

```bash
# Lint all code
npm run lint

# Run the CI-style checks locally
npm run ci
```

### Documentation

```bash
# Docs live in ./docs
ls docs
```

### Deployment

- **test.dlux.io:** Pushes to `main` trigger CD (GitHub webhook → deploy to test.dlux.io). See `docs/webhook-setup.md`.

```bash
# Build all workspaces
npm run build

# Test server deploy script
./deploy-server.sh
```

## Planned / Future Tooling

Some docs mention generators/migrations (`generate:service`, `migrate:*`, `docs:update`, etc.). Those are **not implemented as repo scripts today**; see `docs/architecture-improvements.md` for the planned meta-tooling.

## Service Development

This repo uses explicit TypeScript code (routes/services/repos) plus shared types in `shared/types/`.

- Add routes under `services/{service}/src/routes/`
- Add service logic under `services/{service}/src/services/`
- Add tests under `services/{service}/tests/` (where present)
- Update docs manually (there is no auto-doc generator wired up yet)

## Debugging

- Check the service `/health` endpoints (e.g. `curl http://localhost:3001/health`)
- Watch service logs (terminal output locally; PM2 logs on the server)

## Environment Variables

Each service ships an `env.example`. Copy it to `.env` and edit as needed.

#### SuiNS + Auth Frontend
- `SUINS_SERVICE_URL`: SuiNS resolver base URL for `sui-service` (e.g. `http://localhost:3012`)
- `VITE_SUI_SERVICE_URL`: Frontend API base (default `http://localhost:3001`)
- `VITE_DGRAPH_SERVICE_URL`: Frontend read API base (default `http://localhost:3003`). Used for social feed, GraphQL, subscription, governance. **Set this when building for deploy** (e.g. `https://gql.dlux.io`) or the app will request localhost and fail; see `frontend/vue-app/.env.example`.
- `VITE_AUTH_COOKIE_DOMAIN`: Override shared auth cookie domain (e.g. `.test.dlux.io`)
- `VITE_APP_ROOT_DOMAIN`: Root domain for link generation (e.g. `dlux.io`, `test.dlux.io`)
- `VITE_WALRUS_DOMAIN`: Override Walrus domain (default `walrus.${VITE_APP_ROOT_DOMAIN}`)
- `VITE_SANDBOX_WALRUS_DOMAIN`: Override sandbox/dApp link domain. When on test.dlux.io, defaults to `walrus.dlux.io` (Caddy wildcard is `*.walrus.dlux.io`, not `*.walrus.test.dlux.io`).
- `VITE_APP_ORIGIN`: Override base site origin for links (e.g. `https://dlux.io`)
- `VITE_APP_PROTOCOL`: Protocol for generated links (default `https`)
- `VITE_PRIVACY_POLICY_URL`: Override privacy policy URL
- `VITE_GET_SUI_URL`: Link for users to acquire SUI (buy/swap). Default: `https://www.sui.io/get-started`. Prefer platforms with affiliate programs—set to your partner link when approved (e.g. MoonPay via impact.com, Transak at transak.com/referral-program, Coinbase/Binance/OKX referral).
- `VITE_BRAND_NAME`: Short site name (default `DLUX`)
- `VITE_BRAND_LONG_NAME`: Long site name for marketing copy
- `VITE_BRAND_TAGLINE`: Tagline used in footer copy
- `VITE_BRAND_LOGO_URL`: Full logo URL for navbar
- `VITE_BRAND_LOGO_MARK_URL`: Logo mark URL fallback
- `VITE_BRAND_LOGO_SQUARE_URL`: Square logo URL (favicons, share cards)
- `VITE_BRAND_LOGO_DARK_URL`: Dark-mode logo variant
- `VITE_BRAND_LOGO_LIGHT_URL`: Light-mode logo variant

#### Prediction Markets
- `PM_MIN_POOL_FOR_RATING`: Minimum pool size (SUI) for official ratings

#### ZK Service (Ad Verification)
- `ZK_SERVICE_URL`: ZK service endpoint (default: `http://localhost:3010`)
- `CIRCUIT_WASM_PATH`: Path to compiled circuit WASM file
- `CIRCUIT_ZKEY_PATH`: Path to trusted setup zkey file
- `HOMOMORPHIC_PUBLIC_KEY`: Paillier public key (base64 encoded)
- `HOMOMORPHIC_PRIVATE_KEY`: Paillier private key (base64 encoded, admin only)
- `ADMIN_KEY`: Admin key for decrypting aggregates

#### DGraph Service (Ad Impressions)
- `ZK_SERVICE_URL`: ZK service endpoint (default: `http://localhost:3010`)
- `AD_IMPRESSION_THRESHOLD`: Threshold for Merkle aggregation (default: 100)

#### Sandbox Service (Ad Display)
- `ZK_SERVICE_URL`: ZK service endpoint (default: `http://localhost:3010`)
- `DGRAPH_SERVICE_URL`: DGraph service endpoint (default: `http://localhost:3003`)

#### Walrus Service (Ad Gateway)
- `ZK_SERVICE_URL`: ZK service endpoint (default: `http://localhost:3010`)
- `DGRAPH_SERVICE_URL`: DGraph service endpoint (default: `http://localhost:3003`)
- `CONSENT_REQUIRED`: Enable explicit opt-in consent (default: `true`)
- `CONSENT_COOKIE_NAME`: Consent cookie name (default: `dlux_consent`)
- `CONSENT_COOKIE_VALUE`: Consent cookie value (default: `accepted`)
- `CONSENT_REDIRECT_URL`: Optional consent UI redirect

## Service Ports

- See `docs/system-reference.md` for the canonical list.

- **3000**: Vue frontend (dev / Vite)
- **3001**: SUI Service
- **3002**: Walrus Service
- **3003**: DGraph Service (GraphQL)
- **3004-3005**: Presence Service
- **3006**: Vue frontend (server / PM2 on test box)
- **3007**: Sandbox Service
- **3003**: Dgraph (includes markets & governance)
- **3009**: MCP Service
- **3010**: ZK Service
- **3011**: Webhook Service
- **3013**: Ad service (reserved / planned)

## Useful URLs

- **Frontend (dev)**: http://localhost:3000
- **Frontend (server)**: http://localhost:3006
- **GraphQL Playground**: http://localhost:3003/graphql

## Troubleshooting

### Service Won't Start

1. Check if port is already in use
2. Check environment variables
3. Check service dependencies are running
4. Check service logs (PM2 on server, or terminal output locally)

### Tests Failing

1. Check database is running
2. Check test data is seeded
3. Check environment variables
4. Run tests in isolation: `npm test -- --isolate`

### Build Failing

1. Check linting errors: `npm run lint`
2. Rebuild: `npm run build`

## Getting Help

- **Documentation**: See `docs/` directory
- **Architecture**: See `docs/architecture-overview.md`
- **Improvements**: See `docs/architecture-improvements.md`
- **API Docs**: Not standardized yet (no single generated OpenAPI/Swagger source of truth in this repo today)
- **Code Examples**: See `examples/` directory (planned)
