#!/usr/bin/env bash
# Deploy metadata_pm contracts to SUI mainnet.
# Uses production defaults: 3-day PM, 7-day proposals, 1 SUI posting fee, min 64 / max 128 walrus proofs.
# Requires: sui client active-env=mainnet, funded wallet
# Usage: ./scripts/deploy-mainnet.sh
# Output: PACKAGE_ID and object IDs printed; .package_id written to script dir.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts/metadata_pm"
OUT_FILE="${SCRIPT_DIR}/.package_id_mainnet"

export SUI_NETWORK=mainnet
export SUI_RPC_URL="${SUI_RPC_URL:-https://fullnode.mainnet.sui.io:443}"

cd "$CONTRACTS_DIR"

# Ensure sui client is on mainnet
active_env=$(sui client active-env 2>/dev/null || true)
if [ "$active_env" != "mainnet" ]; then
  echo "Switching to mainnet..."
  sui client switch --env mainnet
fi

# Check gas
echo "Checking gas balance..."
gas_out=$(sui client gas 2>&1) || true
if echo "$gas_out" | grep -q "No gas coins"; then
  addr=$(sui client active-address 2>/dev/null || true)
  echo ""
  echo "No SUI for gas on mainnet. Fund your address."
  exit 1
fi

echo "Building contracts..."
sui move build

echo "Publishing to mainnet..."
out=$(sui client publish --gas-budget 200000000 2>&1)

# Extract PackageID
pid=$(echo "$out" | grep -oE 'PackageID: (0x[a-fA-F0-9]+)' | head -1 | sed 's/PackageID: //')
if [ -z "$pid" ]; then
  echo "Could not parse PACKAGE_ID from publish output"
  echo "$out"
  exit 1
fi

echo "$pid" > "$OUT_FILE"

# Extract object IDs from publish output
gov_config_id=""
pool_id=""
config_id=""
registry_id=""

while IFS= read -r line; do
  if echo "$line" | grep -qi "GovernanceConfig"; then
    id=$(echo "$line" | grep -oE '0x[a-fA-F0-9]{40,}' | head -1)
    [ -n "$id" ] && [ "$id" != "$pid" ] && gov_config_id="$id"
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

echo ""
echo "=============================================="
echo "Mainnet deployment complete"
echo "=============================================="
echo "PACKAGE_ID=$pid"
echo "GovernanceConfig (shared): $gov_config_id"
[ -n "$pool_id" ] && echo "POSTING_POOL_ID=$pool_id"
[ -n "$config_id" ] && echo "POSTING_TREASURY_CONFIG_ID=$config_id"
[ -n "$registry_id" ] && echo "POSTING_REGISTRY_ID=$registry_id"
echo ""
echo "Defaults: pm_duration 3 days, proposal_duration 7 days, posting fee 1 SUI"
echo "Next: call set_treasury_addresses(gov_config, foundation, pm_pool, admin_cap)"
echo "Update server .env with the IDs above."
echo ""
echo "$pid"
