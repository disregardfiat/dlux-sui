#!/bin/bash
# Deploy test frontend from move branch to test.dlux.io
# This builds the Vue app with testnet config and serves on port 3006
# Usage: bash scripts/deploy-test-frontend.sh

set -e

REPO_DIR="${REPO_DIR:-/home/ubuntu/dlux-sui}"
VUE_APP="$REPO_DIR/frontend/vue-app"

cd "$REPO_DIR" || exit 1
if [ -f "$REPO_DIR/.env" ]; then set -a; source "$REPO_DIR/.env"; set +a; fi

echo "🔄 Pulling latest from move branch..."
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
git pull origin move || { 
    echo "⚠️  Pull from move branch failed"
    git status
    exit 1
}
NEW_COMMIT=$(git rev-parse HEAD)

echo "✅ Repository updated (move branch)"
echo ""

if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    echo "ℹ️  No git changes - forcing full rebuild"
    FORCE_BUILD=1
else
    FORCE_BUILD=0
fi

echo "📦 Checking dependencies..."

# Install root dependencies if package.json changed or force build
if [ "$FORCE_BUILD" = "1" ] || git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- package.json package-lock.json 2>/dev/null | grep -q "^+\|^-"; then
    echo "📦 Root dependencies changed, installing..."
    npm install --workspaces=false || true
fi

# Install frontend dependencies if changed
if [ -d "$VUE_APP" ] && [ -f "$VUE_APP/package.json" ]; then
    if [ "$FORCE_BUILD" = "1" ] || git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "frontend/vue-app/package.json" "frontend/vue-app/package-lock.json" 2>/dev/null | grep -q "^+\|^-"; then
        echo "📦 Installing dependencies for vue-frontend..."
        cd "$VUE_APP" && npm install && cd "$REPO_DIR"
    fi
fi

echo ""
echo "🔨 Building vue-frontend for test.dlux.io..."

# Build for testnet (test.dlux.io)
export VITE_SUI_SERVICE_URL="${VITE_SUI_SERVICE_URL:-https://sui.dlux.io}"
export VITE_DGRAPH_SERVICE_URL="${VITE_DGRAPH_SERVICE_URL:-https://gql.dlux.io}"
# Use same-origin proxy to avoid CORS
export VITE_WALRUS_SERVICE_URL="${VITE_WALRUS_SERVICE_URL:-https://test.dlux.io/api/walrus}"
# Testnet package IDs
export VITE_SUI_PACKAGE_ID="${VITE_SUI_PACKAGE_ID:-0xe368eacc58492458a07c109f9ac236f848c6fbdb56bbb10ad5c5ecc4ada37a17}"
export VITE_POSTING_POOL_ID="${VITE_POSTING_POOL_ID:-0xe53210798ac1adce2fb1ea7e3ff091ffe04c30168cee2d6122a56138a9e2f1c2}"

(cd "$VUE_APP" && rm -rf dist && rm -rf node_modules/.vite && npm run build) || {
    echo "⚠️  Vue build failed"
    exit 1
}

echo ""
echo "🔄 Restarting vue-frontend (test.dlux.io on port 3006)..."
if pm2 describe vue-frontend >/dev/null 2>&1; then
    pm2 restart vue-frontend --update-env
else
    echo "⚠️  vue-frontend not in PM2. Starting it..."
    cd "$VUE_APP" && pm2 start $(npm run preview -- --host --port 3006 2>&1 | grep -oP 'Local:\s+\K.*|http://[^:]+:\d+/' | head -1 || echo "npm run preview -- --host --port 3006") --name vue-frontend --update-env || true
    cd "$VUE_APP" && npx vite preview --host --port 3006 &
    sleep 2
fi

echo ""
echo "✅ Test frontend deployment completed!"
echo "   test.dlux.io is now serving the move branch build"
