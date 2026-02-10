#!/bin/bash
# Start DLUX-SUI services in Docker for development/E2E testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$INFRA_DIR"

echo "🐳 Starting DLUX-SUI services in Docker..."
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed or not in PATH"
    exit 1
fi

# Use docker compose (v2) if available, otherwise docker-compose (v1)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif docker-compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Error: docker-compose not found"
    exit 1
fi

# Check if E2E mode is requested
if [ "$1" == "--e2e" ] || [ "$1" == "-e" ]; then
    echo "📦 Starting services for E2E testing..."
    $COMPOSE_CMD -f docker-compose.yml -f docker-compose.e2e.yml up -d
else
    echo "📦 Starting all services..."
    $COMPOSE_CMD up -d
fi

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service health
echo ""
echo "🔍 Checking service health..."

check_health() {
    local service=$1
    local port=$2
    local url="http://localhost:$port/health"
    
    if curl -sf "$url" > /dev/null 2>&1; then
        echo "  ✅ $service (port $port): Healthy"
        return 0
    else
        echo "  ⚠️  $service (port $port): Not responding yet"
        return 1
    fi
}

check_health "SUI Service" 3001
check_health "Walrus Service" 3002
check_health "DGraph Service" 3003

echo ""
echo "✅ Services started! Use 'docker-compose logs -f' to view logs"
echo ""
echo "Service URLs:"
echo "  - SUI Service:    http://localhost:3001"
echo "  - Walrus Service: http://localhost:3002"
echo "  - DGraph Service: http://localhost:3003"
echo ""
echo "To stop services: cd infrastructure && docker-compose down"
