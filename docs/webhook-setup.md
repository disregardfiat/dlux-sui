# Webhook Service Setup Guide

## Overview

The webhook service receives GitHub webhooks and automatically deploys changes to **test.dlux.io** only. Every push to `main` triggers a full build and deploy to test.dlux.io (frontend on port 3006). Production (**dlux.io**, port 3007) is updated only when you run the promote script after E2E tests pass—see [Promoting test to production](#promoting-test-to-production).

## Server Setup

### 1. Create Environment File

On the server, create `.env` file in `services/webhook-service/`:

```bash
cd ~/dlux-sui/services/webhook-service
cp env.example .env
# Edit .env and set GITHUB_WEBHOOK_SECRET
```

Required environment variables:
- `GITHUB_WEBHOOK_SECRET`: Must match the secret configured in GitHub webhook settings
- `REPO_PATH`: Path to the repository (default: `/home/ubuntu/dlux-sui`)
- `DEPLOY_SCRIPT_PATH`: Path to deploy script (default: `/home/ubuntu/dlux-sui/deploy-server.sh` - includes frontend build)

### 2. Install and Build

```bash
cd ~/dlux-sui/services/webhook-service
npm install
npm run build
```

### 3. Start with PM2

```bash
cd ~/dlux-sui/services/webhook-service
pm2 start dist/index.js --name webhook-service --env production
pm2 save
```

## GitHub Webhook Configuration

1. Go to your GitHub repository: `https://github.com/disregardfiat/dlux-sui`
2. Navigate to: **Settings** → **Webhooks** → **Add webhook**
3. Configure:
   - **Payload URL**: `https://webhook.dlux.io/webhook`
   - **Content type**: `application/json`
   - **Secret**: Generate a secure random string (save this!)
   - **Events**: Select "Just the push event"
4. Click **Add webhook**

### Setting the Webhook Secret on Server

After creating the webhook in GitHub:

```bash
cd ~/dlux-sui/services/webhook-service
nano .env
# Set GITHUB_WEBHOOK_SECRET to the same value as GitHub
pm2 restart webhook-service
```

## Testing

### Test Webhook Endpoint

```bash
curl https://webhook.dlux.io/health
```

Should return:
```json
{
  "status": "ok",
  "service": "webhook-service",
  "timestamp": "...",
  "configured": true
}
```

### Test from GitHub

1. Make a commit and push to `main` branch
2. Check webhook delivery in GitHub: **Settings** → **Webhooks** → Click on webhook → **Recent Deliveries**
3. Check server logs: `pm2 logs webhook-service`
4. Verify deployment happened: `pm2 list`

## How It Works

1. Developer pushes to `main` branch on GitHub
2. GitHub sends webhook to `https://webhook.dlux.io/webhook`
3. Caddy routes request to `localhost:3011`
4. Webhook service:
   - Verifies signature using `GITHUB_WEBHOOK_SECRET`
   - Checks if push is to `main` branch
   - Runs `deploy-server.sh`, which pulls, builds, and restarts services
   - **Only test.dlux.io** (vue-frontend on port 3006) is updated; **dlux.io** (vue-frontend-prod on port 3007) is left unchanged until you run the promote script

## Promoting test to production

After E2E tests pass on **test.dlux.io**, promote that build to **dlux.io**:

```bash
# On the server (from repo root)
cd ~/dlux-sui && bash scripts/promote-test-to-prod.sh
```

This copies the test frontend build (`dist`) to the production build (`dist-prod`) and restarts `vue-frontend-prod`. No rebuild is performed—dlux.io serves the same assets that were validated on test.dlux.io.

## Security

- Webhook signatures are verified using HMAC SHA-256
- Only pushes to configured branch (default: `main`) trigger deployment
- Invalid signatures return `401 Unauthorized`
- Service requires `GITHUB_WEBHOOK_SECRET` to be configured

## Troubleshooting

### Webhook Not Received

1. Check Caddy is routing correctly:
   ```bash
   curl https://webhook.dlux.io/health
   ```

2. Check webhook service is running:
   ```bash
   pm2 list
   pm2 logs webhook-service
   ```

3. Verify DNS is correct:
   ```bash
   dig webhook.dlux.io
   ```

### Deployment Not Triggering

1. Check webhook secret matches between GitHub and `.env`
2. Verify webhook is configured for "push" events
3. Check webhook delivery status in GitHub
4. Review service logs: `pm2 logs webhook-service`

### Deployment Fails

1. Check deploy script exists and is executable:
   ```bash
   test -f ~/dlux-sui/deploy.sh && echo "exists" || echo "missing"
   chmod +x ~/dlux-sui/deploy.sh
   ```

2. Check repository path is correct in `.env`
3. Review deployment logs in webhook service output

## Monitoring

View logs:
```bash
pm2 logs webhook-service
pm2 logs webhook-service --lines 100  # Last 100 lines
```

Restart service:
```bash
pm2 restart webhook-service
```

Stop service:
```bash
pm2 stop webhook-service
```
# Webhook verification 2026-02-01T16:52:41-03:00
