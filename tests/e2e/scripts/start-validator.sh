#!/usr/bin/env bash
# Start local Sui validator for E2E testnet. Infra only (docs/testing-style.md).
# Usage: ./start-validator.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${SCRIPT_DIR}/.validator.pid"

if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    echo "Validator already running (PID $pid)"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if ! command -v sui-test-validator &>/dev/null; then
  echo "sui-test-validator not found. Install Sui CLI: https://docs.sui.io/build/install"
  exit 1
fi

echo "Starting sui-test-validator..."
sui-test-validator &
echo $! > "$PID_FILE"
echo "Waiting for RPC..."
for i in $(seq 1 30); do
  if curl -sf -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"rpc.discover","id":1}' http://localhost:9000 >/dev/null 2>&1; then
    echo "Validator ready at http://localhost:9000"
    exit 0
  fi
  sleep 1
done
echo "Validator failed to become ready"
exit 1
