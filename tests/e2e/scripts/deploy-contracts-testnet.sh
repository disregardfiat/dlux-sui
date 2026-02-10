#!/usr/bin/env bash
# Deploy metadata_pm contracts to SUI testnet.
# Requires: sui client active-env=testnet, funded wallet (https://faucet.sui.io/)
# Usage: ./deploy-contracts-testnet.sh
# Output: PACKAGE_ID printed to stdout; also .package_id in script dir.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts/metadata_pm"
OUT_FILE="${SCRIPT_DIR}/.package_id"

export SUI_NETWORK=testnet
export SUI_RPC_URL="${SUI_RPC_URL:-https://fullnode.testnet.sui.io:443}"

cd "$CONTRACTS_DIR"

# Ensure sui client is on testnet
active_env=$(sui client active-env 2>/dev/null || true)
if [ "$active_env" != "testnet" ]; then
  echo "Switching to testnet..."
  sui client switch --env testnet
fi

# Check gas
echo "Checking gas balance..."
gas_out=$(sui client gas 2>&1) || true
if echo "$gas_out" | grep -q "No gas coins"; then
  addr=$(sui client active-address 2>/dev/null || true)
  echo ""
  echo "No SUI for gas. Fund your address at:"
  echo "  https://faucet.sui.io/?address=${addr}"
  echo ""
  echo "Select Testnet, click Request SUI, wait ~1 min, then run this script again."
  echo "See docs/TESTNET_DEPLOYMENT.md for full instructions."
  exit 1
fi

echo "Building contracts..."
sui move build

echo "Publishing to testnet..."
out=$(sui client publish --gas-budget 100000000 2>&1)

# Extract Published Objects / PackageID
pid=$(echo "$out" | grep -oE 'PackageID: (0x[a-fA-F0-9]+)' | head -1 | sed 's/PackageID: //')
if [ -z "$pid" ]; then
  echo "Could not parse PACKAGE_ID from publish output"
  echo "$out"
  exit 1
fi

echo "$pid" > "$OUT_FILE"

# Try to extract PostingFeePool, PostingTreasuryConfig, DappRegistry from publish output
pool_id=""
config_id=""
registry_id=""
while IFS= read -r line; do
  if echo "$line" | grep -q "PostingFeePool"; then
    id=$(echo "$line" | grep -oE '0x[a-fA-F0-9]{40,}' | head -1)
    if [ -n "$id" ] && [ "$id" != "$pid" ]; then pool_id="$id"; fi
  fi
  if echo "$line" | grep -q "PostingTreasuryConfig"; then
    id=$(echo "$line" | grep -oE '0x[a-fA-F0-9]{40,}' | head -1)
    if [ -n "$id" ] && [ "$id" != "$pid" ]; then config_id="$id"; fi
  fi
  if echo "$line" | grep -q "DappRegistry"; then
    id=$(echo "$line" | grep -oE '0x[a-fA-F0-9]{40,}' | head -1)
    if [ -n "$id" ] && [ "$id" != "$pid" ]; then registry_id="$id"; fi
  fi
done <<< "$out"
if [ -n "$pool_id" ]; then
  echo "$pool_id" > "${SCRIPT_DIR}/.posting_pool_id"
  echo "POSTING_POOL_ID=$pool_id"
fi
if [ -n "$config_id" ]; then
  echo "$config_id" > "${SCRIPT_DIR}/.posting_treasury_config_id"
  echo "POSTING_TREASURY_CONFIG_ID=$config_id"
fi
if [ -n "$registry_id" ]; then
  echo "$registry_id" > "${SCRIPT_DIR}/.posting_registry_id"
  echo "POSTING_REGISTRY_ID=$registry_id"
fi

echo ""
echo "Deployed successfully!"
echo "PACKAGE_ID=$pid"
echo ""
echo "Update server .env with: SUI_PACKAGE_ID=$pid"
echo "For E2E on-chain dApp posting, set: PACKAGE_ID=$pid"
if [ -n "$pool_id" ]; then echo "  POSTING_POOL_ID=$pool_id"; fi
if [ -n "$config_id" ]; then echo "  POSTING_TREASURY_CONFIG_ID=$config_id"; fi
if [ -n "$registry_id" ]; then echo "  POSTING_REGISTRY_ID=$registry_id"; fi
echo "Then: pm2 restart sui-service --update-env"
echo ""
echo "$pid"
