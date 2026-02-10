#!/usr/bin/env bash
# Stop local Sui validator. Infra only (docs/testing-style.md).
# Usage: ./stop-validator.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${SCRIPT_DIR}/.validator.pid"

if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE")
  kill "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Stopped validator (PID $pid)"
fi
pkill -f sui-test-validator 2>/dev/null || true
