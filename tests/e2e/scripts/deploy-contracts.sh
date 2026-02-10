#!/usr/bin/env bash
# Deploy metadata_pm contracts to local testnet. Infra only (docs/testing-style.md).
# Requires: validator running, SUI_RPC_URL=http://localhost:9000
# Usage: ./deploy-contracts.sh
# Output: PACKAGE_ID printed to stdout; also .package_id in script dir.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts/metadata_pm"
OUT_FILE="${SCRIPT_DIR}/.package_id"

export SUI_NETWORK=local
export SUI_RPC_URL="${SUI_RPC_URL:-http://localhost:9000}"

cd "$CONTRACTS_DIR"
sui move build
out=$(sui client publish --gas-budget 100000000 2>&1)
# Extract Published Objects / PackageID
pid=$(echo "$out" | grep -oE 'PackageID: (0x[a-fA-F0-9]+)' | head -1 | sed 's/PackageID: //')
if [ -z "$pid" ]; then
  echo "Could not parse PACKAGE_ID from publish output"
  echo "$out"
  exit 1
fi
echo "$pid" > "$OUT_FILE"
echo "PACKAGE_ID=$pid"
echo "$pid"
