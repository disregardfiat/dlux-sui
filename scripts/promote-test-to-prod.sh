#!/bin/bash
# Promote test.dlux.io build to production (dlux.io).
# Run this after E2E tests pass on test.dlux.io to update dlux.io with the same build.
#
# Usage: from repo root on the server:
#   bash scripts/promote-test-to-prod.sh
#
# Or from your machine (if you have SSH access):
#   ssh ubuntu@<server> 'cd /home/ubuntu/dlux-sui && bash scripts/promote-test-to-prod.sh'

set -e

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
VUE_APP="$REPO_DIR/frontend/vue-app"
DIST_TEST="$VUE_APP/dist"
DIST_PROD="$VUE_APP/dist-prod"

cd "$REPO_DIR" || exit 1

if [ ! -d "$DIST_TEST" ]; then
  echo "❌ Test build not found at $DIST_TEST"
  echo "   Run a full deploy first (or push to main so webhook builds test.dlux.io)."
  exit 1
fi

echo "📋 Promoting test.dlux.io → dlux.io"
echo "   Copying $DIST_TEST → $DIST_PROD ..."
rm -rf "$DIST_PROD"
cp -a "$DIST_TEST" "$DIST_PROD"
echo "✅ Build copied to dist-prod"

if pm2 describe vue-frontend-prod > /dev/null 2>&1; then
  echo "🔄 Restarting vue-frontend-prod (dlux.io)..."
  pm2 restart vue-frontend-prod --update-env
  echo "✅ Production frontend restarted. dlux.io now serves the promoted build."
else
  echo "⚠️  vue-frontend-prod not in PM2. Start it manually:"
  echo "   cd $VUE_APP && npx vite preview --outDir dist-prod --host --port 3007"
  echo "   Then ensure Caddy routes dlux.io to localhost:3007"
fi

echo ""
echo "✅ Promotion complete. dlux.io is now serving the same build as test.dlux.io."
