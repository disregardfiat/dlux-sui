# Test Environment

**CD:** Pushes to the `main` branch trigger continuous deployment to **test.dlux.io** (GitHub webhook → webhook service → deploy script). See [webhook-setup.md](./webhook-setup.md) and [webhook-status.md](./webhook-status.md).

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
- `webhook.dlux.io` → `157.180.53.238`

## Caddy Reverse Proxy Configuration

Caddy is configured as a reverse proxy server routing requests to backend services:

| Domain | Backend Service | Port(s) | Service Description |
|--------|----------------|---------|-------------------|
| `tincan` | Presence Service | `3004`, `3005` | WebRTC/VR communication (HTTP + WebSocket) |
| `sui` | SUI Service | `3001` | SUI blockchain integration and ZK auth |
| `gql` | DGraph Service | `3003` | GraphQL API, markets & governance |
| `walrus` | Walrus Service | `3002` | Blob storage for dApps and media (blobs, ads, premium) |
| `test` | Vue Frontend | `3006` | Main Vue.js application |
| `webhook` | Webhook Service | `3011` | GitHub webhook receiver for automated deployments |
| `*.walrus.dlux.io` | Sandbox Service | `3007` | Wildcard subdomain for sandboxed dApps (e.g. `h<hex>.walrus.dlux.io/@owner/permlink`) |

**Walrus vs wildcard:** `walrus.dlux.io` is the Walrus **API** (port 3002). The **wildcard** `*.walrus.dlux.io` goes to the **Sandbox** (port 3007), which serves dApp pages and proxies `/walrus/:blobId` to the Walrus service. So the Walrus suite is behind `walrus.dlux.io`; the wildcard is for the sandbox. Wildcard HTTPS is enabled: Caddy is built with the Cloudflare DNS module and obtains a Let's Encrypt cert for `*.walrus.dlux.io` via DNS-01; see [cloudflare-caddy-build-issue.md](cloudflare-caddy-build-issue.md).

## Service Endpoints

### Production URLs (via Caddy)
- **Frontend:** `https://test.dlux.io` (or `http://test.dlux.io`)
- **GraphQL API:** `https://gql.dlux.io/graphql`
- **SUI Service:** `https://sui.dlux.io`
- **Walrus Service:** `https://walrus.dlux.io`
- **Presence Service:** `https://tincan.dlux.io` (HTTP) + `wss://tincan.dlux.io` (WebSocket)
- **Webhook Service:** `https://webhook.dlux.io/webhook` (GitHub webhook endpoint)

### Direct Service Ports (for testing)
- `localhost:3000` - Vue Frontend (dev / Vite)
- `localhost:3001` - SUI Service
- `localhost:3002` - Walrus Service
- `localhost:3003` - DGraph Service (GraphQL)
- `localhost:3004` - Presence Service (HTTP)
- `localhost:3005` - Presence Service (WebSocket/Hocuspocus)
- `localhost:3006` - Vue Frontend (server / PM2 on test box)
- `localhost:3007` - Sandbox Service
- `localhost:3009` - MCP Service
- `localhost:3010` - ZK Service
- `localhost:3011` - Webhook Service

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

# test.dlux.io: same-origin /api/walrus so the Vue app (built with VITE_WALRUS_SERVICE_URL=https://test.dlux.io/api/walrus) can upload blobs without CORS
test.dlux.io {
    handle /api/walrus/* {
        uri strip_prefix /api/walrus
        reverse_proxy localhost:3002
    }
    handle {
        reverse_proxy localhost:3006
    }
}

webhook.dlux.io {
    reverse_proxy localhost:3011
}

# Wildcard subdomain for sandboxed dApps (address-matched: subdomain = h + hex of owner, up to 63 chars)
# Handles metadata for bots/crawlers and same-origin Walrus blob proxy (IPFS-style for Walrus)
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
    
    # Same-origin dApp assets: /walrus/* -> sandbox -> Walrus blobs
    handle /walrus/* {
        reverse_proxy localhost:3007
    }
    
    # Default: serve dApp document (address-matched HTML from Walrus or shell)
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
- `https://webhook.dlux.io/health` - Webhook Service health check

### GraphQL Playground

Access the GraphQL playground at:
- `https://gql.dlux.io/graphql` (if introspection enabled)

### Frontend Application

The Vue.js frontend is accessible at:
- `https://test.dlux.io`

### dApp URLs (address-matched subdomains)

Sandboxed dApps are served at `*.walrus.dlux.io` with **address-matched subdomains**: the subdomain is `h` + hex of the dApp owner’s SUI address (no `0x`), up to 62 hex chars (63 chars per DNS label), so the host only serves content that address could have posted. URL pattern:

- `https://h<hex>.walrus.dlux.io/@<owner_or_suins>/<permlink>`

Example: `https://h1a2b3c4d5e6f7890...walrus.dlux.io/@0x1a2b3c4d.../mygame`. Assets use same-origin `/walrus/:blobId`, which the sandbox proxies to Walrus. See `docs/sandbox-service.md` for details.

## Troubleshooting

### Deploy not reflecting on dlux.io / test.dlux.io

Both domains are served by the same PM2 process (`vue-frontend` on port 3006). If you pushed and ran deploy but the site still shows old content:

1. **Confirm the server has the latest commit**
   ```bash
   cd /home/ubuntu/dlux-sui && git log -1 --oneline
   ```
   Compare to your latest commit on GitHub (e.g. `main`).

2. **Confirm the build output is fresh**
   ```bash
   ls -la /home/ubuntu/dlux-sui/frontend/vue-app/dist/
   ```
   `index.html` and `assets/` should have modification times from the last deploy.

3. **Confirm PM2 is serving the built app (not dev server)**
   ```bash
   pm2 show vue-frontend
   ```
   The script should be `vite preview` (or `npx vite preview --host --port 3006`) with **cwd** = `.../frontend/vue-app`. If it shows `vite` (dev server), the app is not using `dist/` and deploy builds won’t appear. Fix by stopping, then starting with:
   ```bash
   cd /home/ubuntu/dlux-sui/frontend/vue-app && npx vite preview --host --port 3006
   ```
   Then add/save in PM2 so it survives reboot.

4. **Run a frontend-only deploy**
   ```bash
   cd /home/ubuntu/dlux-sui && bash scripts/deploy-frontend-only.sh
   ```
   This pulls, builds, and restarts `vue-frontend`. Then hard-refresh the site (Ctrl+Shift+R) to avoid cached JS/CSS.

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

### Server Hangs / SSH and Websites Time Out

The test server was previously co-located with the **honeygraph** stack (Docker: honeygraph-api, honeygraph-alpha, honeygraph-zero, honeygraph-redis, honeygraph-ratel). That stack has been **stopped** (`docker compose down` in `/home/ubuntu/honeygraph`), so it no longer runs on this host and is not consuming resources.

If you need to run honeygraph again on this server:

- The compose file at `/home/ubuntu/honeygraph/docker-compose.yml` has been updated so it won’t exhaust the box: **redis** uses `--maxmemory 2gb --maxmemory-policy allkeys-lru` and `mem_limit: 2560m`, and **dgraph-alpha** has `mem_limit: 12g`. Bring the stack back with `cd /home/ubuntu/honeygraph && docker compose up -d` and it will start with those limits.

If the server hangs again (e.g. after reintroducing other workloads):

- Run `free -h` and `docker stats --no-stream` to see what is using memory/CPU.
- Check `dmesg | tail` or `/var/log/syslog` for OOM killer.
- **sui-service** high restart count is often a *symptom* of memory/CPU pressure: the indexer’s RPC/WS calls fail (ECONNRESET, EAI_AGAIN), the process exits, and PM2 restarts it.

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
│  test.dlux.io → localhost:3006        │
│  webhook.dlux.io → localhost:3011     │
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
- ✅ **Webhook Service**: Running on port 3011 (PM2) - GitHub webhook receiver for automated deployments
- ✅ **Cloudflare DNS Module**: Caddy is built with the Cloudflare DNS module; wildcard SSL for `*.walrus.dlux.io` is active (see `docs/cloudflare-caddy-build-issue.md`)

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
- ✅ `*.walrus.dlux.io` - Caddy routes to sandbox (3007); wildcard TLS is enabled via Cloudflare DNS module (see [cloudflare-caddy-build-issue.md](cloudflare-caddy-build-issue.md))

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
- `webhook-service` - Port 3011

**Sandbox-service env (PM2):** For dApp lookup and blob loading, set `SUI_SERVICE_URL` and `WALRUS_SERVICE_URL`. On the test server (all on one host) use `http://localhost:3001` and `http://localhost:3002`. See `services/sandbox-service/env.example`. If unset, sandbox defaults to localhost:3001 and localhost:3002.

**Getting dApp submission and sandbox working:**  
1. Run `./deploy-server.sh` on the test server (builds and restarts all services including sandbox-service; smoke test includes sandbox health).  
2. If sandbox-service was previously the old `frontend/sandbox` app, run `pm2 delete sandbox-service` once, then run deploy again so it starts the TypeScript sandbox from `services/sandbox-service`.  
3. **Walrus upload (post dApp):** The Vue app is built with `VITE_WALRUS_SERVICE_URL=https://test.dlux.io/api/walrus`, so blob uploads go to `test.dlux.io/api/walrus/blobs/upload`. Caddy must proxy that path to the Walrus service (port 3002). If the `test.dlux.io` block in `/etc/caddy/Caddyfile` only has `reverse_proxy localhost:3006`, add the `handle /api/walrus/*` block shown in the Caddy configuration above, then run `sudo systemctl reload caddy`. Otherwise you get a network error when posting a dApp.  
4. Post a dApp from https://test.dlux.io (upload HTML as first file so it becomes the entry), then open the dApp in the Hub and click **Open in Sandbox**. The sandbox URL is `https://h<hex>.walrus.dlux.io/@<owner>/<permlink>`; the sandbox calls SUI service for lookup and Walrus for blobs. **Note:** dApp links from test.dlux.io use `walrus.dlux.io` (not `walrus.test.dlux.io`) because the Caddy wildcard is `*.walrus.dlux.io`. Override with `VITE_SANDBOX_WALRUS_DOMAIN` if needed.

### DGraph database and deploy -dump

**dgraph-service** (port 3003) and **sui-service** (SuiNS profiles) connect to a DGraph database. By default they expect **DGraph** at `localhost:9080` (gRPC) and `localhost:8080` (HTTP alter).

- **Start DGraph on the server (Docker):** From the repo root, run:
  ```bash
  docker compose -f infrastructure/docker-compose.dgraph-only.yml up -d
  ```
  This starts **dgraph-zero** and **dgraph-alpha** (ports 5080/8000 and 8080/9080). After alpha is healthy, restart **dgraph-service** and **sui-service** so they connect and apply schema:
  ```bash
  pm2 restart dgraph-service sui-service --update-env
  ```

- **Deploy script with -dump:** To pull, build, **reset DGraph (drop all data)**, clear in-memory dApp listings, and restart services for a fresh test environment:
  ```bash
  ./deploy-server.sh -dump
  ```
  The script will (1) ensure DGraph is running via the compose file above, (2) wait for alpha HTTP (port 8080), (3) run `scripts/reset-dgraph.sh` (POST /alter with `drop_all`; fails if alpha returns errors, e.g. "unauthorized ip" — the compose file uses `--security "whitelist=..."` so the host can call /alter), (4) create a sentinel file so **sui-service** clears its in-memory dApp list on next start (new dApps will be indexed as usual; in poll mode the list may repopulate with recent chain events), (5) restart all PM2 services. **dgraph-service** and **sui-service** will reconnect and re-apply schema. Use this to freshen the test env.

- **Manual DGraph reset:** To only wipe DGraph without a full deploy:
  ```bash
  DGRAPH_ALPHA_HTTP=http://localhost:8080 DROP_MODE=drop_all ./scripts/reset-dgraph.sh
  pm2 restart dgraph-service sui-service --update-env
  ```

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