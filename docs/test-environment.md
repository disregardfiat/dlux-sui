# Test Environment

## Server Configuration

**Server IP:** `157.180.53.238`  
**Server Hostname:** `naf`  
**OS:** Ubuntu (Linux 6.8.0-63-generic)

## DNS Configuration

The following DNS A records are configured as subdomains of `dlux.io` pointing to `157.180.53.238`:

- `tincan.dlux.io` → `157.180.53.238`
- `sui.dlux.io` → `157.180.53.238`
- `gql.dlux.io` → `157.180.53.238`
- `walrus.dlux.io` → `157.180.53.238`
- `test.dlux.io` → `157.180.53.238`

## Caddy Reverse Proxy Configuration

Caddy is configured as a reverse proxy server routing requests to backend services:

| Domain | Backend Service | Port(s) | Service Description |
|--------|----------------|---------|-------------------|
| `tincan` | Presence Service | `3004`, `3005` | WebRTC/VR communication (HTTP + WebSocket) |
| `sui` | SUI Service | `3001` | SUI blockchain integration and ZK auth |
| `gql` | DGraph Service | `3003` | GraphQL API for dApp queries |
| `walrus` | Walrus Service | `3002` | Blob storage for dApps and media |
| `test` | Vue Frontend | `3006` | Main Vue.js application |
| `*.walrus.dlux.io` | Sandbox Service | `3007` | Wildcard subdomain for sandboxed dApps with PWA support |

## Service Endpoints

### Production URLs (via Caddy)
- **Frontend:** `https://test.dlux.io` (or `http://test.dlux.io`)
- **GraphQL API:** `https://gql.dlux.io/graphql`
- **SUI Service:** `https://sui.dlux.io`
- **Walrus Service:** `https://walrus.dlux.io`
- **Presence Service:** `https://tincan.dlux.io` (HTTP) + `wss://tincan.dlux.io` (WebSocket)

### Direct Service Ports (for testing)
- `localhost:3000` - Vue Frontend
- `localhost:3001` - SUI Service
- `localhost:3002` - Walrus Service
- `localhost:3003` - DGraph Service (GraphQL)
- `localhost:3004` - Presence Service (HTTP)
- `localhost:3005` - Presence Service (WebSocket/Hocuspocus)

## Caddy Configuration

The Caddyfile is located at `/etc/caddy/Caddyfile`:

```caddy
tincan {
    reverse_proxy localhost:3004
    reverse_proxy localhost:3005
}

sui {
    reverse_proxy localhost:3001
}

gql {
    reverse_proxy localhost:3003
}

walrus {
    reverse_proxy localhost:3002
}

test.dlux.io {
    reverse_proxy localhost:3006
}

# Wildcard subdomain for sandboxed dApps
# Handles metadata for bots/crawlers and serves dApp content
*.walrus.dlux.io {
    # Metadata endpoint for bots/crawlers (preview without loading full dApp)
    @metadata {
        header User-Agent /bot|crawl|spider|slurp|google|bing|yandex/i
        method HEAD
        path_regexp ^(?:/([a-zA-Z]{3,}))?/@([^/]+)/([^/]+)$
    }
    handle @metadata {
        rewrite * /metadata?author={re.2}&permlink={re.3}&tag={re.1}
        reverse_proxy localhost:3007
    }
    
    # Regular dApp content serving
    @walrus {
        header Referer https://{labels.3}.walrus.dlux.io*
    }
    handle @walrus {
        reverse_proxy /walrus/* localhost:3007
    }
    
    # Default: serve from sandbox service
    handle {
        reverse_proxy localhost:3007
    }
}
```

## Service Status

To check service status:

```bash
# Check Caddy status
sudo systemctl status caddy

# Check if services are listening on ports
sudo netstat -tlnp | grep -E ':(3000|3001|3002|3003|3004|3005)'

# View Caddy logs
sudo journalctl -u caddy -f
```

## Testing the Environment

### Health Checks

Each service provides a `/health` endpoint:

- `https://sui.dlux.io/health` - SUI Service health check
- `https://walrus.dlux.io/health` - Walrus Service health check
- `https://gql.dlux.io/health` - DGraph Service health check
- `https://tincan.dlux.io/health` - Presence Service health check

### GraphQL Playground

Access the GraphQL playground at:
- `https://gql.dlux.io/graphql` (if introspection enabled)

### Frontend Application

The Vue.js frontend is accessible at:
- `https://test.dlux.io`

## Troubleshooting

### Caddy Not Reloading
```bash
sudo systemctl reload caddy
# Or manually reload
sudo caddy reload --config /etc/caddy/Caddyfile
```

### Service Not Responding
1. Check if the service is running on the expected port
2. Verify firewall rules allow traffic
3. Check service logs for errors
4. Ensure DNS is resolving correctly

### TLS Certificate Issues
Caddy will automatically obtain TLS certificates via Let's Encrypt. If certificates fail:
- Verify DNS records are correct
- Check Caddy logs: `sudo journalctl -u caddy`
- Ensure ports 80 and 443 are open

## Network Architecture

```
Internet
   ↓
DNS (tincan.dlux.io, sui.dlux.io, gql.dlux.io, walrus.dlux.io, test.dlux.io → 157.180.53.238)
   ↓
Caddy (Port 80/443)
   ↓
┌─────────────────────────────────────┐
│  Reverse Proxy Routing              │
├─────────────────────────────────────┤
│  tincan.dlux.io → localhost:3004,3005 │
│  sui.dlux.io → localhost:3001         │
│  gql.dlux.io → localhost:3003         │
│  walrus.dlux.io → localhost:3002      │
│  test.dlux.io → localhost:3000        │
└─────────────────────────────────────┘
   ↓
Backend Services (Node.js/TypeScript)
```

## Current Status

**Last Verified:** January 13, 2025 - ✅ **ALL SERVICES OPERATIONAL**

### Service Status
- ✅ **Caddy**: Running and configured
- ✅ **SUI Service**: Running on port 3001 (PM2)
- ✅ **Walrus Service**: Running on port 3002 (PM2)
- ✅ **DGraph Service**: Running on port 3003 (PM2)
- ✅ **Presence Service**: Running on ports 3004/3005 (PM2)
- ✅ **Vue Frontend**: Running on port 3006 (PM2)
- ✅ **Sandbox Service**: Running on port 3007 (PM2) - dApp sandbox with PWA support
- ⚠️ **Cloudflare DNS Module**: Caddy needs to be rebuilt with Cloudflare DNS module for wildcard SSL (see `docs/cloudflare-caddy-build-issue.md`)

### Testing Results

**Caddy Configuration:**
- ✅ Caddyfile updated with full domain names (`*.dlux.io`)
- ✅ Caddy reloaded successfully
- ✅ Reverse proxy configuration active and working

**Service Availability (Verified via curl):**
- ✅ `https://sui.dlux.io/health` - Responding correctly
- ✅ `https://walrus.dlux.io/health` - Responding correctly
- ✅ `https://gql.dlux.io/health` - Responding correctly
- ✅ `https://tincan.dlux.io/health` - Responding correctly
- ✅ `https://test.dlux.io` - Vue frontend serving correctly
- ✅ `*.walrus.dlux.io` - Wildcard subdomain configured and routing (TLS with Cloudflare DNS module pending)

**PM2 Process Management:**
All services are managed with PM2 and will auto-restart on server reboot:
```bash
pm2 list                    # View all services
pm2 logs sui-service        # View logs
pm2 restart all             # Restart all services
pm2 save                    # Save current process list
pm2 startup                 # Enable auto-start on boot
```

### Service Endpoints Verified

All backend services are accessible via their domains:

- ✅ **SUI Service**: `https://sui.dlux.io`
  - Health: `https://sui.dlux.io/health`
  - Returns: `{"status":"ok","service":"sui-service","timestamp":"..."}`

- ✅ **Walrus Service**: `https://walrus.dlux.io`
  - Health: `https://walrus.dlux.io/health`
  - Returns: `{"status":"ok","service":"walrus-service","timestamp":"..."}`

- ✅ **DGraph Service**: `https://gql.dlux.io`
  - Health: `https://gql.dlux.io/health`
  - GraphQL: `https://gql.dlux.io/graphql`
  - Returns: `{"status":"ok","service":"dgraph-service","ts":"..."}`

- ✅ **Presence Service**: `https://tincan.dlux.io`
  - Health: `https://tincan.dlux.io/health`
  - WebSocket: `wss://tincan.dlux.io` (port 3005)
  - Returns: `{"status":"ok","service":"presence-service","ts":"..."}`

### Service Management

All services are managed with PM2 and configured to auto-start:

```bash
pm2 list                    # View all services
pm2 logs <service-name>     # View logs for a service
pm2 restart all             # Restart all services
pm2 save                    # Save current process list (already done)
pm2 startup                 # Enable auto-start on boot (if needed)
```

**Current PM2 Services:**
- `sui-service` - Port 3001
- `walrus-service` - Port 3002
- `dgraph-service` - Port 3003
- `presence-service` - Ports 3004/3005
- `vue-frontend` - Port 3006
- `sandbox-service` - Port 3007

### Next Steps

1. **Enhance Services:**
   - Add full functionality to each service
   - Implement database connections
   - Add authentication and security
   - Deploy full Vue.js application with routing

2. **Cloudflare DNS Setup:**
   - Build Caddy with Cloudflare DNS module
   - Configure Cloudflare API token
   - Enable automatic SSL for wildcard subdomain
   - See [Cloudflare DNS Setup Guide](cloudflare-dns-setup.md)

3. **Production Hardening:**
   - Configure proper TLS certificates
   - Set up monitoring and logging
   - Implement rate limiting
   - Add backup and recovery procedures

## Last Updated

Configuration last updated: January 13, 2025