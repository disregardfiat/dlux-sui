#!/bin/bash
# DLUX-SUI PM2 Deployment Script
# Pulls from GitHub and restarts services

set -e

REPO_DIR="/home/ubuntu/dlux-sui"
SERVICES=("sui-service" "walrus-service" "dgraph-service" "presence-service" "pm-service")
FRONTEND=("vue-frontend" "sandbox-service")

cd "$REPO_DIR" || exit 1

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
    echo "ℹ️  No changes to deploy"
    exit 0
fi

echo "📦 Checking dependencies..."

# Install root dependencies if package.json changed
if git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- package.json | grep -q "^+\|^-"; then
    echo "📦 Root dependencies changed, installing..."
    npm install --workspaces=false
fi

# Install dependencies for services
for service in "${SERVICES[@]}"; do
    SERVICE_DIR="$REPO_DIR/services/$service"
    if [ -d "$SERVICE_DIR" ] && [ -f "$SERVICE_DIR/package.json" ]; then
        if git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "services/$service/package.json" | grep -q "^+\|^-"; then
            echo "📦 Installing dependencies for $service..."
            cd "$SERVICE_DIR" && npm install && cd "$REPO_DIR"
        fi
    fi
done

# Install frontend dependencies
if [ -d "$REPO_DIR/frontend/vue-app" ] && [ -f "$REPO_DIR/frontend/vue-app/package.json" ]; then
    if git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "frontend/vue-app/package.json" | grep -q "^+\|^-"; then
        echo "📦 Installing dependencies for vue-frontend..."
        cd "$REPO_DIR/frontend/vue-app" && npm install && cd "$REPO_DIR"
    fi
fi

if [ -d "$REPO_DIR/frontend/sandbox" ] && [ -f "$REPO_DIR/frontend/sandbox/package.json" ]; then
    if git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "frontend/sandbox/package.json" | grep -q "^+\|^-"; then
        echo "📦 Installing dependencies for sandbox-service..."
        cd "$REPO_DIR/frontend/sandbox" && npm install && cd "$REPO_DIR"
    fi
fi

echo ""
echo "🔨 Building TypeScript services..."

# Build shared types first
if [ -d "$REPO_DIR/shared/types" ]; then
    if git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "shared/types/**" | grep -q "^+\|^-"; then
        echo "🔨 Building shared types..."
        cd "$REPO_DIR/shared/types" && npm run build 2>/dev/null || echo "⚠️  Build script not found"
        cd "$REPO_DIR"
    fi
fi

# Build services
for service in "${SERVICES[@]}"; do
    SERVICE_DIR="$REPO_DIR/services/$service"
    if [ -d "$SERVICE_DIR" ] && [ -f "$SERVICE_DIR/tsconfig.json" ]; then
        if git diff "$CURRENT_COMMIT" "$NEW_COMMIT" -- "services/$service/**" | grep -q "^+\|^-"; then
            echo "🔨 Building $service..."
            cd "$SERVICE_DIR" && npm run build 2>/dev/null || echo "⚠️  Build script not found or no changes"
            cd "$REPO_DIR"
        fi
    fi
done

echo ""
echo "🔄 Restarting PM2 services..."

# Restart services
for service in "${SERVICES[@]}" "${FRONTEND[@]}"; do
    if pm2 describe "$service" > /dev/null 2>&1; then
        echo "🔄 Restarting $service..."
        pm2 restart "$service" || echo "⚠️  Failed to restart $service"
    else
        echo "⚠️  Service $service not found in PM2"
    fi
done

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📊 PM2 Status:"
pm2 list
