# Cloudflare DNS Setup for Wildcard SSL Certificates

## Overview

The `*.walrus.dlux.io` wildcard subdomain is configured in Caddy to serve sandboxed dApps. To enable automatic SSL certificate management via Cloudflare DNS, Caddy needs to be built with the Cloudflare DNS module.

## Current Status

- ✅ Wildcard subdomain configured: `*.walrus.dlux.io`
- ✅ Sandbox service running on port 3007
- ⚠️ Cloudflare DNS module not yet installed in Caddy
- ⚠️ Cloudflare API token needs to be configured

## Setup Steps

### 1. Install/Update Go

Caddy with Cloudflare DNS module requires Go 1.21 or later:

```bash
# Check current Go version
go version

# If needed, install/update Go
# Option 1: Use official Go installer
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# Option 2: Use snap
sudo snap install go --classic
```

### 2. Install xcaddy

```bash
go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
```

### 3. Build Caddy with Cloudflare DNS Module

```bash
# Build custom Caddy
~/go/bin/xcaddy build \
    --with github.com/caddy-dns/cloudflare \
    --output /tmp/caddy-cloudflare

# Backup original Caddy
sudo cp /usr/bin/caddy /usr/bin/caddy.backup

# Install new Caddy
sudo mv /tmp/caddy-cloudflare /usr/bin/caddy
sudo chmod +x /usr/bin/caddy

# Verify installation
/usr/bin/caddy version
```

### 4. Configure Cloudflare API Token

1. **Get Cloudflare API Token:**
   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Create token with:
     - Permissions: Zone → DNS → Edit
     - Zone Resources: Include → Specific zone → `dlux.io`

2. **Set Environment Variable:**
   
   Edit `/etc/systemd/system/caddy.service.d/cloudflare.conf`:
   ```ini
   [Service]
   Environment="CLOUDFLARE_API_TOKEN=your-actual-token-here"
   ```

3. **Reload systemd and restart Caddy:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart caddy
   ```

### 5. Verify Configuration

```bash
# Check Caddy logs
sudo journalctl -u caddy -f

# Test wildcard subdomain
curl -I https://test.walrus.dlux.io

# Check SSL certificate
openssl s_client -connect test.walrus.dlux.io:443 -servername test.walrus.dlux.io
```

## Caddyfile Configuration

The wildcard subdomain is configured in `/etc/caddy/Caddyfile`:

```caddy
*.walrus.dlux.io {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy localhost:3007
}
```

## Sandbox Service

The sandbox service:
- Runs on port 3007
- Managed by PM2 as `sandbox-service`
- Extracts subdomain from request hostname
- Will inject wallet/nav JavaScript for dApp execution
- Provides sandboxed environment for user dApps

## Testing

Once configured, test with:

```bash
# Health check
curl https://test.walrus.dlux.io/health

# Any subdomain works
curl https://myapp.walrus.dlux.io
curl https://suiabc123.walrus.dlux.io
```

## Troubleshooting

### Certificate Not Issuing

1. Check Cloudflare API token is correct
2. Verify token has DNS edit permissions for `dlux.io`
3. Check Caddy logs: `sudo journalctl -u caddy -f`
4. Verify DNS records are pointing to server IP

### Module Not Found Error

If you see `module not registered: dns.providers.cloudflare`:
- Caddy needs to be rebuilt with the module (see step 3 above)
- Restart Caddy after rebuilding

### Environment Variable Not Working

- Ensure systemd override file exists: `/etc/systemd/system/caddy.service.d/cloudflare.conf`
- Run `sudo systemctl daemon-reload` after editing
- Restart Caddy: `sudo systemctl restart caddy`

## Alternative: Manual Certificate Management

If automatic DNS-01 challenge doesn't work, you can:
1. Use HTTP-01 challenge (requires port 80 accessible)
2. Manually obtain certificates and configure them
3. Use Cloudflare's proxy (orange cloud) for automatic SSL

## Security Notes

- Keep Cloudflare API token secure
- Use least-privilege token permissions
- Rotate tokens periodically
- Monitor Caddy logs for certificate issues