# Full E2E Tests with Local Testnet, Wallet Signing, and Walrus Storage

This guide explains how to run complete end-to-end tests with:
- ✅ Local Sui validator (local testnet)
- ✅ Real wallet signing
- ✅ Real Walrus storage
- ✅ On-chain contract interactions
- ✅ Complete ad network journeys

## Prerequisites

### 1. Install Sui CLI

```bash
# Install Sui CLI (if not already installed)
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui

# OR using Homebrew (macOS)
brew install sui

# Verify installation
sui --version
```

### 2. Start Local Sui Validator

```bash
# Start local Sui validator (creates local testnet)
sui-test-validator

# This will:
# - Start a local Sui validator on port 9000
# - Create test accounts with funded wallets
# - Provide RPC endpoint: http://localhost:9000
# - Provide faucet endpoint: http://localhost:9123/gas
```

**Keep this terminal running!** The validator must stay running for tests.

### 3. Deploy Contracts to Local Testnet

```bash
# In a new terminal, deploy contracts
cd contracts/metadata_pm

# Set environment to use local validator
export SUI_NETWORK=local
export SUI_RPC_URL=http://localhost:9000

# Build contracts
sui move build

# Deploy contracts
sui client publish --gas-budget 100000000

# Save the package ID from output (you'll need it for tests)
# Example: Published Objects: PackageID: 0x1234...
export PACKAGE_ID=<your-package-id>
```

### 4. Configure Test Environment

Create `.env.testnet` file:

```bash
# Local Sui Validator
SUI_NETWORK=local
SUI_RPC_URL=http://localhost:9000
SUI_FAUCET_URL=http://localhost:9123/gas
PACKAGE_ID=<your-package-id>

# Services
SUI_SERVICE_URL=http://localhost:3001
DGRAPH_SERVICE_URL=http://localhost:3003
WALRUS_SERVICE_URL=http://localhost:3002
ZK_SERVICE_URL=http://localhost:3010

# Test Accounts (from sui-test-validator output)
TEST_ADVERTISER_ADDRESS=<address-from-validator>
TEST_CREATOR_ADDRESS=<address-from-validator>
TEST_USER_ADDRESS=<address-from-validator>
```

### 5. Start Services with Testnet Config

```bash
# Start services pointing to local validator
cd infrastructure

# Use testnet override
docker-compose -f docker-compose.yml -f docker-compose.testnet.yml up -d

# OR start services manually with env vars
export SUI_NETWORK=local
export SUI_RPC_URL=http://localhost:9000
npm run dev:all
```

### 6. Fund Test Accounts

```bash
# Get test account addresses from sui-test-validator output
# Fund them using the local faucet
curl -X POST http://localhost:9123/gas \
  -H "Content-Type: application/json" \
  -d '{"FixedAmountRequest":{"recipient":"<test-address>"}}'

# Or use Sui CLI
sui client faucet <test-address>
```

## Running Full E2E Tests

### Option 1: Run Complete Journey Tests

```bash
# Run full ad network journey tests
npm run test:e2e:full

# This will test:
# - Ad campaign creation (on-chain)
# - Content creation with ad marking
# - User signing ads (ZK proofs)
# - Click bundling and aggregation
# - Tranche redemption (on-chain)
# - Revenue distribution (on-chain)
# - PM resolution and payouts
```

### Option 2: Run Individual Journey Tests

```bash
# Ad journey only
npx playwright test tests/e2e/ad-journey-full.spec.ts

# User journey only
npx playwright test tests/e2e/user-journey-full.spec.ts

# Revenue distribution journey
npx playwright test tests/e2e/revenue-distribution-full.spec.ts
```

### Option 3: Run with UI (Recommended for First Time)

```bash
# See tests run in browser
npm run test:e2e:full:ui
```

## Test Structure

Full E2E tests are organized by journey:

```
tests/e2e/
├── ad-journey-full.spec.ts          # Complete ad campaign creation flow
├── content-creation-full.spec.ts     # Content creation with ad marking
├── user-journey-full.spec.ts        # User viewing, signing, clicking ads
├── subscribe-journey-full.spec.ts   # Subscription flow
├── click-bundling-full.spec.ts      # Click aggregation and redemption
├── revenue-distribution-full.spec.ts # PM resolution and payouts
└── helpers/
    ├── wallet-helpers.ts            # Wallet signing utilities
    ├── blockchain-helpers.ts        # On-chain interaction helpers
    ├── walrus-helpers.ts            # Walrus storage helpers
    └── testnet-helpers.ts           # Testnet setup helpers
```

## What Gets Tested

### ✅ On-Chain Interactions
- Campaign creation with escrow funding
- Transaction signing with real wallets
- Contract method calls
- Event emission and indexing
- Revenue distribution transactions

### ✅ Wallet Signing
- Real wallet connection
- Transaction signing
- Message signing for authentication
- Multi-signature flows (if applicable)

### ✅ Walrus Storage
- Content upload to Walrus
- Blob storage and retrieval
- Seal encryption/decryption
- Access control verification

### ✅ Complete Flows
- End-to-end ad campaign lifecycle
- User interaction with ads
- Click tracking and aggregation
- Revenue redemption and distribution
- PM resolution and payouts

## Troubleshooting

### Local Validator Not Running

```bash
# Check if validator is running
curl http://localhost:9000

# Restart validator
sui-test-validator
```

### Contracts Not Deployed

```bash
# Check if package exists
sui client object <package-id>

# Redeploy if needed
cd contracts/metadata_pm
sui client publish --gas-budget 100000000
```

### Services Can't Connect to Validator

```bash
# Verify SUI_RPC_URL is set correctly
echo $SUI_RPC_URL  # Should be http://localhost:9000

# Check service logs
docker-compose logs sui-service
```

### Wallet Signing Fails

```bash
# Ensure test accounts are funded
sui client gas <test-address>

# Fund if needed
sui client faucet <test-address>
```

### Walrus Storage Issues

```bash
# Check Walrus service is running
curl http://localhost:3002/health

# Verify Walrus network connection
# (For local testing, Walrus may use mock storage)
```

## Test Data Management

### Test Accounts

Full E2E tests use real test accounts from the local validator:

```typescript
// Test accounts are created by sui-test-validator
const testAccounts = {
  advertiser: process.env.TEST_ADVERTISER_ADDRESS,
  creator: process.env.TEST_CREATOR_ADDRESS,
  user: process.env.TEST_USER_ADDRESS,
};
```

### Test Data Cleanup

Tests automatically clean up:
- Test campaigns are cancelled after tests
- Test content is marked for deletion
- Test transactions are tracked for verification

## CI/CD Integration

For CI/CD, use a similar setup:

```yaml
# .github/workflows/e2e-full.yml
name: Full E2E Tests

on: [push, pull_request]

jobs:
  e2e-full:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Sui CLI
        run: |
          cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui
      - name: Start Local Validator
        run: sui-test-validator &
      - name: Deploy Contracts
        run: |
          cd contracts/metadata_pm
          sui client publish --gas-budget 100000000
      - name: Run E2E Tests
        run: npm run test:e2e:full
```

## Next Steps

1. **Run Full E2E Tests**: Follow the setup above and run `npm run test:e2e:full`
2. **Review Test Results**: Check test output and Playwright reports
3. **Debug Failures**: Use `npm run test:e2e:full:debug` for interactive debugging
4. **Extend Tests**: Add more test scenarios as needed

## Related Documentation

- [Ad Network Journeys](../docs/ad-network-journeys.md) - Complete journey documentation
- [E2E Test README](./README.md) - Basic E2E test setup
- [Docker Setup](./DOCKER_SETUP.md) - Docker-based testing
- [Contract Architecture](../docs/contracts/contract-architecture.md) - On-chain contracts
