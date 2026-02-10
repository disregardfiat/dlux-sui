#!/bin/bash
# Stop DLUX-SUI services in Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$INFRA_DIR"

echo "🛑 Stopping DLUX-SUI services..."

# Use docker compose (v2) if available, otherwise docker-compose (v1)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif docker-compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Error: docker-compose not found"
    exit 1
fi

$COMPOSE_CMD down

echo "✅ Services stopped"
