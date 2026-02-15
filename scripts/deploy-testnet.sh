#!/usr/bin/env bash
# Deploy metadata_pm contracts to SUI testnet with test-friendly defaults.
# Applies bootstrap_testnet: 1-min PM, 1-min proposals, min 1 / max 128 walrus proofs, 0.1 SUI posting fee.
# Requires: sui client active-env=testnet, funded wallet (https://faucet.sui.io/)
# Usage: ./scripts/deploy-testnet.sh
# Output: PACKAGE_ID and object IDs printed; .package_id_testnet written to script dir.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts/metadata_pm"
OUT_FILE="${SCRIPT_DIR}/.package_id_testnet"

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
  exit 1
fi

echo "Building contracts..."
sui move build

echo "Publishing to testnet..."
out=$(sui client publish --gas-budget 150000000 2>&1)

# Extract PackageID
pid=$(echo "$out" | grep -oE 'PackageID: (0x[a-fA-F0-9]+)' | head -1 | sed 's/PackageID: //')
if [ -z "$pid" ]; then
  echo "Could not parse PACKAGE_ID from publish output"
  echo "$out"
  exit 1
fi

echo "$pid" > "$OUT_FILE"

# Extract object IDs from publish output (format varies by Sui CLI version)
gov_config_id=""
gov_admin_cap_id=""
pool_id=""
config_id=""
registry_id=""

while IFS= read -r line; do
  if echo "$line" | grep -qi "GovernanceConfig"; then
    id=$(echo "$line" | grep -oE '0x[a-fA-F0-9]{40,}' | head -1)
    [ -n "$id" ] && [ "$id" != "$pid" ] && gov_config_id="$id"
  fi
  if echo "$line" | grep -qi "GovernanceAdminCap"; then
    id=$(echo "$line" | grep -oE '0x[a-fA-F0-9]{40,}' | head -1)
    [ -n "$id" ] && [ "$id" != "$pid" ] && gov_admin_cap_id="$id"
  fi
  if echo "$line" | grep -qi "PostingFeePool"; then
    id=$(echo "$line" | grep -oE '0x[a-fA-F0-9]{40,}' | head -1)
    [ -n "$id" ] && [ "$id" != "$pid" ] && pool_id="$id"
  fi
  if echo "$line" | grep -qi "PostingTreasuryConfig"; then
    id=$(echo "$line" | grep -oE '0x[a-fA-F0-9]{40,}' | head -1)
    [ -n "$id" ] && [ "$id" != "$pid" ] && config_id="$id"
  fi
  if echo "$line" | grep -qi "DappRegistry"; then
    id=$(echo "$line" | grep -oE '0x[a-fA-F0-9]{40,}' | head -1)
    [ -n "$id" ] && [ "$id" != "$pid" ] && registry_id="$id"
  fi
done <<< "$out"

# Write extracted IDs for other scripts
[ -n "$pool_id" ] && echo "$pool_id" > "${SCRIPT_DIR}/.posting_pool_id_testnet"
[ -n "$config_id" ] && echo "$config_id" > "${SCRIPT_DIR}/.posting_treasury_config_id_testnet"
[ -n "$registry_id" ] && echo "$registry_id" > "${SCRIPT_DIR}/.posting_registry_id_testnet"

# Call bootstrap_testnet if we have the IDs
if [ -n "$gov_config_id" ] && [ -n "$gov_admin_cap_id" ]; then
  echo "Applying testnet overrides (1-min PM, relaxed walrus bounds)..."
  if sui client call \
    --package "$pid" \
    --module governance \
    --function bootstrap_testnet \
    --args "$gov_config_id" "$gov_admin_cap_id" \
    --gas-budget 50000000 2>/dev/null; then
    echo "bootstrap_testnet applied successfully."
  else
    echo "Warning: bootstrap_testnet failed (may already be applied). Continue anyway."
  fi
else
  echo "Warning: Could not extract GovernanceConfig or GovernanceAdminCap IDs."
  echo "Run manually: sui client call --package $pid --module governance --function bootstrap_testnet --args <GOV_CONFIG_ID> <GOV_ADMIN_CAP_ID>"
fi

echo ""
echo "=============================================="
echo "Testnet deployment complete"
echo "=============================================="
echo "PACKAGE_ID=$pid"
[ -n "$gov_config_id" ] && echo "GovernanceConfig=$gov_config_id"
[ -n "$pool_id" ] && echo "POSTING_POOL_ID=$pool_id"
[ -n "$config_id" ] && echo "POSTING_TREASURY_CONFIG_ID=$config_id"
[ -n "$registry_id" ] && echo "POSTING_REGISTRY_ID=$registry_id"
echo ""
echo "Testnet overrides: pm_duration 1 min, proposal_duration 1 min, posting fee 0.1 SUI, min_walrus 1"
echo "Next: call set_treasury_addresses(gov_config, foundation, pm_pool, admin_cap)"
echo "Update server .env with the IDs above."
echo ""
echo "$pid"
