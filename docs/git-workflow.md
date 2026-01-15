# Git Workflow for Test Server

This document describes how to manage files on the test server using Git.

## Overview

The test server (`157.180.53.238`) maintains a local Git repository that syncs with the GitHub repository (`disregardfiat/dlux-sui`). All file changes should be managed through Git to maintain consistency.

## Initial Setup

The test server repository is located at `/home/ubuntu/dlux-sui` and is configured to:
- Track the `main` branch from `https://github.com/disregardfiat/dlux-sui`
- Use Git user: `dlux-server <ubuntu@dlux.io>`
- Have `.gitignore` configured to exclude secrets, node_modules, and build artifacts

## Workflow

### 1. Making Changes

**From Local Development Machine:**
```bash
# Make changes locally
# Commit and push to GitHub
git add .
git commit -m "Your commit message"
git push origin main
```

**On Test Server:**
```bash
# SSH into the server
ssh -i /home/jr/wrt ubuntu@157.180.53.238

# Navigate to repository
cd ~/dlux-sui

# Pull latest changes
git pull origin main
```

### 2. Automated Deployment

The deployment script (`deploy.sh`) automatically:
- Pulls latest changes from GitHub
- Detects which dependencies changed
- Installs new dependencies
- Builds TypeScript services
- Restarts PM2 services

**To deploy:**
```bash
cd ~/dlux-sui
./deploy.sh
```

The script will:
1. Pull latest from `origin/main`
2. Check for dependency changes in `package.json` files
3. Install dependencies only for changed services
4. Build TypeScript services if source files changed
5. Restart PM2 services gracefully

### 3. Manual Deployment Steps

If you need to deploy manually:

```bash
cd ~/dlux-sui

# Pull changes
git pull origin main

# Install dependencies (if changed)
cd services/sui-service && npm install && cd ../..
cd services/walrus-service && npm install && cd ../..
# ... repeat for other services

# Build TypeScript
cd shared/types && npm run build && cd ../..
cd services/sui-service && npm run build && cd ../..
# ... repeat for other services

# Restart PM2 services
pm2 restart sui-service
pm2 restart walrus-service
# ... repeat for other services
```

## PM2 Services

Current services managed by PM2:
- `sui-service` - Port 3001
- `walrus-service` - Port 3002
- `dgraph-service` - Port 3003
- `presence-service` - Ports 3004/3005
- `vue-frontend` - Port 3006
- `sandbox-service` - Port 3007

**PM2 Commands:**
```bash
pm2 list                    # View all services
pm2 logs <service-name>     # View logs for a service
pm2 restart <service-name>  # Restart a service
pm2 restart all             # Restart all services
pm2 stop <service-name>     # Stop a service
pm2 save                    # Save current process list
```

## Best Practices

1. **Always use Git**: Never edit files directly on the server. Make changes locally, commit, and push to GitHub.

2. **Pull before making changes**: If you need to make changes on the server (for testing), pull first:
   ```bash
   git pull origin main
   ```

3. **Use deployment script**: The `deploy.sh` script handles dependency installation and service restarts automatically.

4. **Keep secrets safe**: The `.gitignore` excludes:
   - `mcp.json` (contains GitHub PAT)
   - `*.env` files
   - `node_modules/`
   - Build artifacts

5. **Check service status**: After deployment, verify services are running:
   ```bash
   pm2 list
   pm2 logs
   ```

6. **Test endpoints**: Verify services respond correctly:
   ```bash
   curl https://sui.dlux.io/health
   curl https://walrus.dlux.io/health
   curl https://gql.dlux.io/health
   curl https://tincan.dlux.io/health
   ```

## Troubleshooting

### Git Pull Fails with Conflicts

If you have local changes that conflict:
```bash
# Check what's changed
git status

# Option 1: Stash local changes
git stash
git pull origin main
git stash pop  # Apply stashed changes if needed

# Option 2: Discard local changes (careful!)
git reset --hard origin/main
```

### Service Won't Start After Deployment

```bash
# Check logs
pm2 logs <service-name>

# Check if dependencies are installed
cd services/<service-name>
npm install

# Rebuild
npm run build

# Restart
pm2 restart <service-name>
```

### PM2 Service Not Found

If a service isn't running in PM2:
```bash
# Check if service exists
pm2 describe <service-name>

# If not, you may need to start it manually
cd ~/dlux-sui
# Follow service-specific startup instructions
```

## Using SSH MCP for Server Management

You can use the SSH MCP server to manage the test server from your IDE:

```typescript
// Example: Pull latest changes
call_mcp_tool({
  server: "user-ssh-mcp",
  toolName: "exec",
  arguments: {
    command: "cd ~/dlux-sui && git pull origin main"
  }
});

// Example: Run deployment
call_mcp_tool({
  server: "user-ssh-mcp",
  toolName: "exec",
  arguments: {
    command: "cd ~/dlux-sui && ./deploy.sh"
  }
});
```

## Integration with GitHub MCP

You can also use the GitHub MCP server to manage the repository:

```typescript
// Example: Create a branch
call_mcp_tool({
  server: "github",
  toolName: "create_branch", // example tool
  arguments: {
    repo: "disregardfiat/dlux-sui",
    branch: "feature/new-feature"
  }
});
```

## Next Steps

1. Set up CI/CD pipeline (optional)
2. Add deployment notifications
3. Set up automated backups
4. Configure monitoring and alerting
