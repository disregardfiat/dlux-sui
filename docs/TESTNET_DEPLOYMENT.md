# SUI Deployment Guide

Deploy metadata_pm contracts and run full E2E tests.

## Current Production Deployment (2026-02-09, mainnet) – 50/50 split

| Item | Value |
|------|-------|
| **Package ID** | `0xdd3ba042c03854131831a0d301960be2d7aba1d9528344610b9fa9bd960cdb2f` |
| **PostingFeePool** | `0xad2a6cd97b68a077010c712cd10d4f949c958a5a0d64c486026be6117cdb6b4f` |
| **RevenuePool** | `0x94d5e0bb4de115410a37a3faa31842c70933fb1ab62550d65cba5c63ec61d56d` |
| **ClickTokenRegistry** | `0x9a58f49b8a1caae8619f57439266d691fb6fb7cdf61aad02899358e0b79014d2` |
| **AdminCap (ad_payments)** | (see publish output) |
| **PostingAdminCap** | (see publish output) |
| **VerifierCap** | `0xa789f82f355ab6efec1df35ac0a09c8ba61ad7d72304257ca0419542a6bda446` |
| **Deployer Address** | `0x630572a8aab639319188b15eac3a46b0bda02633a0023a19d704dc6ab1b41ace` |
| **Network** | mainnet |
| **Modules** | ad_campaigns, ad_payments, ad_tracking, dapp_posting, metadata_pm |
| **Explorer** | [View on SuiScan](https://suiscan.xyz/mainnet/object/0xdd3ba042c03854131831a0d301960be2d7aba1d9528344610b9fa9bd960cdb2f) |

**Posting fee split (post_dapp):** 50% → PM pool, 50% → foundation. Set `PM_POOL_ADDRESS` and `FOUNDATION_ADDRESS` (can use deployer for both initially).

## Previous Testnet Deployment (2026-02-06, archived)

| Item | Value |
|------|-------|
| **Package ID** | `0x6a98cdb0a1689dee6140970a65e6a79cfde435dc6059f6d238262f5123216931` |
| **Network** | testnet |
| **Explorer** | [View on SuiScan](https://suiscan.xyz/testnet/object/0x6a98cdb0a1689dee6140970a65e6a79cfde435dc6059f6d238262f5123216931) |

## Service URLs (Production)

| Service | URL | Port |
|---------|-----|------|
| SUI Service (API) | https://sui.dlux.io | 3001 |
| Walrus Service | https://walrus.dlux.io | 3002 |
| DGraph Service | https://gql.dlux.io | 3003 |
| Frontend | https://test.dlux.io | 3006 |
| Sandbox Service | localhost:3007 | 3007 |

## Prerequisites

- **Sui CLI** installed (`sui --version`)
- **Funded wallet** on the target network

## Step 1: Fund Your Wallet

### Mainnet
Send SUI to your deployer address via an exchange or another wallet.

### Testnet
```bash
sui client active-address
# Visit: https://faucet.sui.io/?address=<YOUR_ADDRESS>
```

## Step 2: Deploy Contracts

```bash
# Switch to the target network
sui client switch --env mainnet  # or testnet

# Publish
cd contracts/metadata_pm
sui client publish --gas-budget 200000000
```

The publish command outputs all created object IDs in the JSON response.

## Step 3: Update Server Configuration

```bash
# On server (via SSH)
cd /home/ubuntu/dlux-sui

# Update root .env
vim .env   # Set SUI_NETWORK, SUI_RPC_URL, SUI_PACKAGE_ID

# Update sui-service .env
vim services/sui-service/.env   # Set all object IDs, keys

# Update dgraph-service .env
vim services/dgraph-service/.env   # Set SUI_PACKAGE_ID, network

# Rebuild and restart
cd services/sui-service && npm run build && cd ../..
cd services/dgraph-service && npm run build && cd ../..
cd frontend/vue-app && npx vite build && cd ../..

pm2 restart sui-service dgraph-service vue-frontend
pm2 save
```

## Step 4: Verify Deployment

```bash
# Health checks
curl https://sui.dlux.io/health/detailed
curl https://gql.dlux.io/health
curl https://walrus.dlux.io/health
curl -o /dev/null -w "%{http_code}" https://test.dlux.io

# Ad settlement status
curl https://sui.dlux.io/ads/settlement/status

# Walrus gateway nodes
curl https://sui.dlux.io/ads/walrus/nodes
```

## Step 5: Run E2E Tests

```bash
# API-only tests
npm run test:e2e:testnet

# On-chain tests (require funded wallet)
PACKAGE_ID=0x... TEST_ADVERTISER_PRIVATE_KEY=<base64> npm run test:e2e:testnet
```

## Move Unit Tests

```bash
cd contracts/metadata_pm
sui move test
```

## Troubleshooting

### "No gas coins are owned by this address"
- Fund via exchange (mainnet) or faucet (testnet)

### "Client/Server api version mismatch"
- Non-fatal warning; deploy should still work
- Update Sui CLI: `cargo install --locked --git https://github.com/MystenLabs/sui.git sui`

### Frontend returns 403
- Check `vite.config.ts` `allowedHosts` includes the domain
- Rebuild with `npx vite build` after `.env` changes (VITE_ vars are baked at build time)

### UI changes not visible (e.g. SuiNS in navbar / dApp links)
- PM2 must run the **built** app: `npx vite preview --host --port 3006` (not `npx vite`). If it runs the dev server, it doesn’t use `dist/`.
- On the server, run a clean frontend build and restart: `bash scripts/deploy-frontend-only.sh` (from repo root). Then hard-refresh the site (Ctrl+Shift+R) and re-login so the wallet label gets the SuiNS name from the auth response.

### Indexer shows 0 events
- Expected for fresh deployment (no on-chain transactions yet)
- Post a dApp to generate first events
