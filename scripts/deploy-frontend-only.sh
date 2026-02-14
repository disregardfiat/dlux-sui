#!/bin/bash
# Frontend-only deploy: pull, build Vue app, restart vue-frontend.
# Use when you only changed frontend and want dlux.io / test.dlux.io to reflect it.
# Both domains point at the same PM2 process (port 3006); one restart updates both.
# Usage: from repo root on the server, run: bash scripts/deploy-frontend-only.sh

set -e

REPO_DIR="${REPO_DIR:-/home/ubuntu/dlux-sui}"

cd "$REPO_DIR" || exit 1
if [ -f "$REPO_DIR/.env" ]; then set -a; source "$REPO_DIR/.env"; set +a; fi

echo "🔄 Pulling latest from GitHub..."
git fetch origin
git pull origin main || { echo "⚠️  Pull failed"; git status; exit 1; }

echo ""
echo "🔨 Building vue-frontend..."

export VITE_SUI_SERVICE_URL="${VITE_SUI_SERVICE_URL:-https://sui.dlux.io}"
export VITE_DGRAPH_SERVICE_URL="${VITE_DGRAPH_SERVICE_URL:-https://gql.dlux.io}"
export VITE_WALRUS_SERVICE_URL="${VITE_WALRUS_SERVICE_URL:-https://test.dlux.io/api/walrus}"
export VITE_SUI_PACKAGE_ID="${VITE_SUI_PACKAGE_ID:-0xe368eacc58492458a07c109f9ac236f848c6fbdb56bbb10ad5c5ecc4ada37a17}"
export VITE_POSTING_POOL_ID="${VITE_POSTING_POOL_ID:-0xe53210798ac1adce2fb1ea7e3ff091ffe04c30168cee2d6122a56138a9e2f1c2}"

(cd "$REPO_DIR/frontend/vue-app" && rm -rf dist && rm -rf node_modules/.vite && npm run build) || {
  echo "⚠️  Vue build failed"
  exit 1
}

echo ""
echo "🔄 Restarting vue-frontend (serves both dlux.io and test.dlux.io on port 3006)..."
if pm2 describe vue-frontend >/dev/null 2>&1; then
  pm2 restart vue-frontend --update-env
else
  echo "⚠️  vue-frontend not in PM2. Start it from frontend/vue-app with:"
  echo "   cd $REPO_DIR/frontend/vue-app && npx vite preview --host --port 3006"
  exit 1
fi

echo ""
echo "✅ Frontend deploy done. Hard-refresh the site (Ctrl+Shift+R) to avoid cached assets."
