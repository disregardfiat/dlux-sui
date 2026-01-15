# Webhook Service

GitHub webhook service for automated deployments of the DLUX-SUI platform.

## Features

- Receives and verifies GitHub webhook events
- Automatically pulls latest changes from Git
- Triggers deployment script on push to main branch
- Signature verification for security
- Health check endpoint

## Configuration

Copy `env.example` to `.env` and configure:

```bash
PORT=3008
LOG_LEVEL=info
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
REPO_PATH=/home/ubuntu/dlux-sui
DEPLOY_SCRIPT_PATH=/home/ubuntu/dlux-sui/deploy.sh
DEPLOY_BRANCH=main
```

## GitHub Webhook Setup

1. Go to your GitHub repository settings
2. Navigate to "Webhooks"
3. Click "Add webhook"
4. Set Payload URL: `https://webhook.dlux.io/webhook`
5. Content type: `application/json`
6. Secret: Set the same value as `GITHUB_WEBHOOK_SECRET`
7. Events: Select "Just the push event" or "Let me select individual events" and choose "Pushes"
8. Click "Add webhook"

## API Endpoints

### POST /webhook
Receives GitHub webhook events. Only processes push events to the configured branch.

**Headers:**
- `X-Hub-Signature-256`: GitHub webhook signature (automatically verified)
- `X-Github-Event`: Event type (e.g., "push", "ping")
- `X-Github-Delivery`: Unique delivery ID

**Response:**
```json
{
  "message": "Webhook received, deployment started",
  "repository": "disregardfiat/dlux-sui",
  "branch": "main",
  "commits": 1,
  "deliveryId": "..."
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "webhook-service",
  "timestamp": "2024-01-15T01:30:00.000Z",
  "configured": true
}
```

## Deployment Flow

1. Developer pushes to `main` branch on GitHub
2. GitHub sends webhook to `/webhook` endpoint
3. Service verifies webhook signature
4. Service pulls latest changes from Git
5. Service executes `deploy.sh` script
6. Deployment script:
   - Detects changed dependencies
   - Installs new dependencies
   - Builds TypeScript services
   - Restarts PM2 services

## Security

- Webhook signatures are verified using HMAC SHA-256
- Only pushes to configured branch trigger deployment
- Invalid signatures return 401 Unauthorized
- Service requires `GITHUB_WEBHOOK_SECRET` to be configured

## Development

```bash
# Install dependencies
npm install

# Copy environment config
cp env.example .env

# Run in development mode
npm run dev

# Build
npm run build

# Start
npm start
```

## Logging

Logs are written to:
- Console (all environments)
- `logs/combined.log` (non-production)
- `logs/error.log` (errors only, non-production)

## Troubleshooting

### Webhook Not Triggering Deployment

1. Check webhook secret is configured correctly in both GitHub and `.env`
2. Verify Caddy is routing requests correctly
3. Check service logs: `pm2 logs webhook-service`
4. Test webhook manually: `curl -X POST https://webhook.dlux.io/health`

### Deployment Fails

1. Check deployment script exists and is executable
2. Verify repository path is correct
3. Check Git repository has proper permissions
4. Review deployment logs in service output
