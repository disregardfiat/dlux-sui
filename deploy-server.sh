#!/bin/bash
# DLUX-SUI PM2 Deployment Script
# Pulls from GitHub and restarts services.
# Usage: ./deploy-server.sh [ -dump ]
#   -dump   Reset DGraph (drop all data), restart dgraph/sui/walrus (and other) services for a fresh test env.
#           Without -dump, walrus-service is not restarted so in-memory blobs (dApp assets) survive deploy.

set -e

REPO_DIR="/home/ubuntu/dlux-sui"
SERVICES=("sui-service" "walrus-service" "dgraph-service" "presence-service" "webhook-service" "sandbox-service")
FRONTEND=("vue-frontend" "sandbox-service")

DO_DUMP=0
for arg in "$@"; do
  case "$arg" in
    -dump|--dump) DO_DUMP=1 ;;
  esac
done

cd "$REPO_DIR" || exit 1
# Optional: set DGRAPH_ALPHA_HTTP, WALRUS_DATA_DIR, etc. on the server
if [ -f "$REPO_DIR/.env" ]; then set -a; source "$REPO_DIR/.env"; set +a; fi

echo "🔄 Pulling latest changes from GitHub..."
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
git pull origin main || {
    echo "⚠️  Pull failed - checking for local changes"
    git status
    exit 1
}
NEW_COMMIT=$(git rev-parse HEAD)

echo "✅ Repository updated"
echo ""

if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    echo "ℹ️  No git changes - forcing full build and restart (e.g. webhook pre-pull or redeploy)"
    FORCE_BUILD=1
else
    FORCE_BUILD=0
fi

echo "📦 Checking dependencies..."

# Install root dependencies if package.json changed or force build
if [ "$FORCE_BUILD" = "1" ] || git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- package.json | grep -q "^+\|^-"; then
    echo "📦 Root dependencies changed, installing..."
    npm install --workspaces=false
fi

# Install dependencies for services
for service in "${SERVICES[@]}"; do
    SERVICE_DIR="$REPO_DIR/services/$service"
    if [ -d "$SERVICE_DIR" ] && [ -f "$SERVICE_DIR/package.json" ]; then
        if [ "$FORCE_BUILD" = "1" ] || git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "services/$service/package.json" | grep -q "^+\|^-"; then
            echo "📦 Installing dependencies for $service..."
            cd "$SERVICE_DIR" && npm install && cd "$REPO_DIR"
        fi
    fi
done

# Install frontend dependencies
if [ -d "$REPO_DIR/frontend/vue-app" ] && [ -f "$REPO_DIR/frontend/vue-app/package.json" ]; then
    if [ "$FORCE_BUILD" = "1" ] || git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "frontend/vue-app/package.json" | grep -q "^+\|^-"; then
        echo "📦 Installing dependencies for vue-frontend..."
        cd "$REPO_DIR/frontend/vue-app" && npm install && cd "$REPO_DIR"
    fi
fi

if [ -d "$REPO_DIR/frontend/sandbox" ] && [ -f "$REPO_DIR/frontend/sandbox/package.json" ]; then
    if [ "$FORCE_BUILD" = "1" ] || git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "frontend/sandbox/package.json" | grep -q "^+\|^-"; then
        echo "📦 Installing dependencies for sandbox-service..."
        cd "$REPO_DIR/frontend/sandbox" && npm install && cd "$REPO_DIR"
    fi
fi

echo ""
echo "🔨 Building TypeScript services..."

# Build shared types first
if [ -d "$REPO_DIR/shared/types" ]; then
    if [ "$FORCE_BUILD" = "1" ] || git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "shared/types/**" | grep -q "^+\|^-"; then
        echo "🔨 Building shared types..."
        cd "$REPO_DIR/shared/types" && npm run build 2>/dev/null || echo "⚠️  Build script not found"
        cd "$REPO_DIR"
    fi
fi

# Build frontend on every deploy (runs on push via webhook) — deploys to test.dlux.io only (vue-frontend port 3006). Use scripts/promote-test-to-prod.sh to push to dlux.io.
# Use test.dlux.io backends so Hub/detail page and post flow call sui/gql/walrus.dlux.io
export VITE_SUI_SERVICE_URL="${VITE_SUI_SERVICE_URL:-https://sui.dlux.io}"
export VITE_DGRAPH_SERVICE_URL="${VITE_DGRAPH_SERVICE_URL:-https://gql.dlux.io}"
# Same-origin proxy on test avoids CORS/404 from browser to walrus.dlux.io
export VITE_WALRUS_SERVICE_URL="${VITE_WALRUS_SERVICE_URL:-https://test.dlux.io/api/walrus}"
# On-chain dApp posting: package and pool IDs from testnet deployment
export VITE_SUI_PACKAGE_ID="${VITE_SUI_PACKAGE_ID:-0xe368eacc58492458a07c109f9ac236f848c6fbdb56bbb10ad5c5ecc4ada37a17}"
export VITE_POSTING_POOL_ID="${VITE_POSTING_POOL_ID:-0xe53210798ac1adce2fb1ea7e3ff091ffe04c30168cee2d6122a56138a9e2f1c2}"
if [ -d "$REPO_DIR/frontend/vue-app" ]; then
  echo "🔨 Building vue-frontend (run on every deploy/push)..."
  (cd "$REPO_DIR/frontend/vue-app" && rm -rf dist && rm -rf node_modules/.vite && npm run build) || {
    echo "⚠️  Vue build failed"
    exit 1
  }
fi

# Build services
for service in "${SERVICES[@]}"; do
    SERVICE_DIR="$REPO_DIR/services/$service"
    if [ -d "$SERVICE_DIR" ] && [ -f "$SERVICE_DIR/tsconfig.json" ]; then
        if [ "$FORCE_BUILD" = "1" ] || git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "services/$service/**" | grep -q "^+\|^-"; then
            echo "🔨 Building $service..."
            cd "$SERVICE_DIR" && npm run build 2>/dev/null || echo "⚠️  Build script not found or no changes"
            cd "$REPO_DIR"
        fi
    fi
done

# SUI indexer configuration — package ID from testnet deployment
export SUI_PACKAGE_ID="${SUI_PACKAGE_ID:-0xe368eacc58492458a07c109f9ac236f848c6fbdb56bbb10ad5c5ecc4ada37a17}"

# Walrus: persist blobs to disk so deploy restarts don't drop dApp assets.
# Set WALRUS_DATA_DIR in services/walrus-service/.env (e.g. WALRUS_DATA_DIR=/home/ubuntu/dlux-sui/data/walrus)
# so the process sees it; then blobs survive PM2 restart. If unset, blobs are in-memory only.
mkdir -p "$REPO_DIR/data/walrus"

# DGraph: ensure database is running (docker); optionally -dump to freshen test env
export DGRAPH_HOST="${DGRAPH_HOST:-localhost:9080}"
DGRAPH_ALPHA_HTTP="${DGRAPH_ALPHA_HTTP:-http://localhost:8080}"
COMPOSE_FILE="$REPO_DIR/infrastructure/docker-compose.dgraph-only.yml"
if command -v docker >/dev/null 2>&1 && [ -f "$COMPOSE_FILE" ]; then
  echo ""
  echo "🐘 Ensuring DGraph is running..."
  if ! (ss -tln 2>/dev/null || netstat -tln 2>/dev/null) | grep -q ':9080'; then
    (cd "$REPO_DIR" && docker compose -f infrastructure/docker-compose.dgraph-only.yml up -d) || true
  fi
  # Wait for alpha HTTP (8080) before talking to it (needed after start or when -dump runs reset)
  wait_for_alpha() {
    echo "   Waiting for DGraph alpha HTTP (port 8080)..."
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
      if curl -sf -o /dev/null "${DGRAPH_ALPHA_HTTP}/health" 2>/dev/null; then
        echo "   DGraph alpha is ready."
        return 0
      fi
      sleep 3
    done
    echo "   ⚠️  DGraph alpha did not respond at ${DGRAPH_ALPHA_HTTP}/health within 60s"
    return 1
  }
  if [ "$DO_DUMP" = "1" ]; then
    wait_for_alpha || true
    echo "🗑️  Resetting DGraph (-dump): dropping all data..."
    DGRAPH_ALPHA_HTTP="$DGRAPH_ALPHA_HTTP" DROP_MODE=drop_all \
      bash "$REPO_DIR/scripts/reset-dgraph.sh" || echo "⚠️  DGraph reset failed (alpha may not be up; check DGRAPH_ALPHA_HTTP and that alpha is on port 8080)"
    sleep 3
    echo "   Restarting dgraph/sui/walrus (below) clears in-memory state: dApp listings (sui-service) and blobs (walrus-service) will be empty."
  else
    # After starting containers, wait so services can connect (8080 may not be up yet)
    if ! (ss -tln 2>/dev/null || netstat -tln 2>/dev/null) | grep -q ':8080'; then
      wait_for_alpha || true
    fi
  fi
else
  echo ""
  echo "ℹ️  Docker or compose file not found; skipping DGraph start. Set DGRAPH_HOST if DGraph runs elsewhere."
fi

# With -dump: create sentinel so sui-service clears in-memory dApps on next start (and seeds indexer cursor so it won't re-ingest).
if [ "$DO_DUMP" = "1" ]; then
  CLEAR_SENTINEL="${CLEAR_DAPPS_SENTINEL:-$REPO_DIR/.clear-dapps-on-next-start}"
  export CLEAR_DAPPS_SENTINEL="$CLEAR_SENTINEL"
  touch "$CLEAR_SENTINEL" && echo "   Created clear-dapps sentinel: $CLEAR_SENTINEL (sui-service will clear dApp list on start)"
fi

echo ""
echo "🔄 Restarting PM2 services..."

# Restart services. Without -dump, skip walrus-service so in-memory blobs (dApp assets) are not lost.
for service in "${SERVICES[@]}" "${FRONTEND[@]}"; do
  if [ "$DO_DUMP" = "0" ] && [ "$service" = "walrus-service" ]; then
    echo "⏭️  Skipping walrus-service (use -dump to restart and clear blobs)"
    continue
  fi
  if pm2 describe "$service" > /dev/null 2>&1; then
    echo "🔄 Restarting $service..."
    pm2 restart "$service" --update-env || echo "⚠️  Failed to restart $service"
  else
    echo "⚠️  Service $service not found in PM2"
    if [ "$service" = "sandbox-service" ] && [ -f "$REPO_DIR/services/sandbox-service/dist/src/index.js" ]; then
      echo "  Starting sandbox-service from services/sandbox-service (SUI_SERVICE_URL and WALRUS_SERVICE_URL default to localhost)..."
      cd "$REPO_DIR/services/sandbox-service" && pm2 start dist/src/index.js --name sandbox-service --update-env && cd "$REPO_DIR"
    fi
  fi
done

echo ""
echo "🔎 Smoke test (localhost)..."
sleep 5  # Give PM2 time to bring services up
if [ -f "$REPO_DIR/scripts/smoke-test.sh" ]; then
  SUI_URL=http://localhost:3001 \
  WALRUS_URL=http://localhost:3002 \
  DGRAPH_URL=http://localhost:3003 \
  PRESENCE_URL=http://localhost:3004 \
  WEBHOOK_URL=http://localhost:3011 \
  SANDBOX_URL=http://localhost:3007 \
  FRONTEND_URL=http://localhost:3006 \
  bash "$REPO_DIR/scripts/smoke-test.sh" || {
    echo "⚠️  Smoke test failed"
    exit 1
  }
else
  echo "⚠️  scripts/smoke-test.sh not found, skipping"
fi

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📊 PM2 Status:"
pm2 list
