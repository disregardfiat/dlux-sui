# Cloudflare DNS Module Build Issue

## Problem

Building Caddy with the Cloudflare DNS module is failing due to Go version conflicts. The latest Caddy requires Go 1.25, but the build process is encountering compilation errors.

## Current Status

- ✅ Cloudflare API token configured in `/etc/systemd/system/caddy.service.d/cloudflare.conf`
- ✅ Caddyfile configured with Cloudflare DNS TLS section (currently commented out)
- ⚠️ Caddy needs to be rebuilt with Cloudflare DNS module
- ⚠️ Go installation has conflicts between versions

## Solutions

### Option 1: Clean Go Installation

```bash
# Remove conflicting Go installations
sudo rm -rf /usr/local/go
sudo rm -rf /usr/lib/go-*

# Install Go 1.25 cleanly
cd /tmp
wget https://go.dev/dl/go1.25.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.25.0.linux-amd64.tar.gz
export PATH=/usr/local/go/bin:$PATH

# Verify
go version

# Build Caddy
~/go/bin/xcaddy build --with github.com/caddy-dns/cloudflare --output /tmp/caddy-cloudflare
sudo mv /tmp/caddy-cloudflare /usr/bin/caddy
sudo chmod +x /usr/bin/caddy
sudo systemctl restart caddy
```

### Option 2: Use Pre-built Caddy with Cloudflare

Download a pre-built Caddy binary with Cloudflare DNS module from:
- https://github.com/caddy-dns/cloudflare/releases
- Or use a Docker image with the module pre-installed

### Option 3: Use HTTP-01 Challenge (Temporary)

For now, the wildcard subdomain can work with HTTP-01 challenge if port 80 is accessible:

```caddy
*.walrus.dlux.io {
    # Use HTTP-01 challenge instead of DNS-01
    # This requires port 80 to be accessible from the internet
    reverse_proxy localhost:3007
}
```

### Option 4: Use Cloudflare Proxy

Enable Cloudflare's proxy (orange cloud) for the wildcard subdomain, which provides automatic SSL without DNS-01 challenge.

## Current Workaround

The Caddyfile has the TLS section commented out, so Caddy can start and serve the wildcard subdomain over HTTP. The sandbox service is fully functional, just without automatic SSL certificates for wildcard subdomains.

## Next Steps

1. Clean up Go installation conflicts
2. Build Caddy with Cloudflare DNS module
3. Uncomment TLS section in Caddyfile
4. Restart Caddy and verify SSL certificates are issued

## Token Configuration

The Cloudflare API token is already configured in:
- `/etc/systemd/system/caddy.service.d/cloudflare.conf`
- Token: `B5CYYiQnnnMGfLgsu4HzpygbNzwPvSwGFVk6JII0`

Once Caddy is rebuilt with the module, the token will be automatically used for DNS-01 challenges.
