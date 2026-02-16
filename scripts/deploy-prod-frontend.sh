#!/bin/bash
# Deploy production frontend from main branch to dlux.io
# This builds the Vue app with mainnet config and serves on port 3008
# Usage: bash scripts/deploy-prod-frontend.sh

set -e

REPO_DIR="${REPO_DIR:-/home/ubuntu/dlux-sui}"
VUE_APP="$REPO_DIR/frontend/vue-app"

cd "$REPO_DIR" || exit 1
if [ -f "$REPO_DIR/.env" ]; then set -a; source "$REPO_DIR/.env"; set +a; fi

echo "🔄 Pulling latest from main branch..."
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
git pull origin main || { 
    echo "⚠️  Pull from main branch failed"
    git status
    exit 1
}
NEW_COMMIT=$(git rev-parse HEAD)

echo "✅ Repository updated (main branch)"
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
echo "🔨 Building vue-frontend for dlux.io..."

# Build for mainnet (dlux.io) - different output directory
export VITE_SUI_SERVICE_URL="${VITE_SUI_SERVICE_URL:-https://sui.dlux.io}"
export VITE_DGRAPH_SERVICE_URL="${VITE_DGRAPH_SERVICE_URL:-https://gql.dlux.io}"
export VITE_WALRUS_SERVICE_URL="${VITE_WALRUS_SERVICE_URL:-https://walrus.dlux.io}"
# Mainnet package IDs - these should be set from .env or defaults
export VITE_SUI_PACKAGE_ID="${VITE_SUI_PACKAGE_ID}"
export VITE_POSTING_POOL_ID="${VITE_POSTING_POOL_ID}"

# Build to dist-prod for production
(cd "$VUE_APP" && rm -rf dist-prod && rm -rf node_modules/.vite && npm run build) || {
    echo "⚠️  Vue build failed"
    exit 1
}

# The build outputs to 'dist' by default, copy to dist-prod for production
if [ -d "$VUE_APP/dist" ] && [ ! -d "$VUE_APP/dist-prod" ]; then
    cp -a "$VUE_APP/dist" "$VUE_APP/dist-prod"
fi

echo ""
echo "🔄 Restarting vue-frontend-prod (dlux.io on port 3008)..."
if pm2 describe vue-frontend-prod >/dev/null 2>&1; then
    pm2 restart vue-frontend-prod --update-env
else
    echo "⚠️  vue-frontend-prod not in PM2. Starting it..."
    cd "$VUE_APP" && npx vite preview --outDir dist-prod --host --port 3008 &
    sleep 2
fi

echo ""
echo "✅ Production frontend deployment completed!"
echo "   dlux.io is now serving the main branch build"
