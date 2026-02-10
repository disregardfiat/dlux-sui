# Cloudflare DNS Module Build Issue

## Problem

Building Caddy with the Cloudflare DNS module required Go 1.25+ (Caddy v2.10.2). The system Go was 1.22, and the Go toolchain auto-download of 1.25 was not available in the build environment.

## Resolution (Completed)

- ✅ **Go 1.25** installed from https://go.dev/dl/ (e.g. `go1.25.7.linux-amd64.tar.gz`) under `/usr/local/go`
- ✅ **Caddy built** with Cloudflare DNS module using xcaddy:
  ```bash
  export PATH=/usr/local/go/bin:$PATH
  ~/go/bin/xcaddy build --with github.com/caddy-dns/cloudflare --output /tmp/caddy-cloudflare
  ```
- ✅ **Binary installed**: Caddy was stopped, `/usr/bin/caddy` replaced with the new binary, Caddy restarted
- ✅ **Caddyfile** updated: `*.walrus.dlux.io` site block now includes:
  ```caddy
  tls {
      dns cloudflare {env.CLOUDFLARE_API_TOKEN}
  }
  ```
- ✅ **Cloudflare API token** in `/etc/systemd/system/caddy.service.d/cloudflare.conf` (env `CLOUDFLARE_API_TOKEN`)
- ✅ **Wildcard certificate** obtained via DNS-01 (Let's Encrypt); HTTPS for `*.walrus.dlux.io` is working

## Current Status

- `*.walrus.dlux.io` is served over HTTPS with a valid Let's Encrypt wildcard certificate.
- Renewal is automatic (CertMagic / Caddy).
- Sandbox (e.g. `https://test.walrus.dlux.io`) may return 502 if the sandbox service is down or the path has no app; that is an upstream/sandbox issue, not TLS.

## Rebuilding Caddy (e.g. after Caddy upgrade)

1. Ensure Go 1.25+ is in `PATH` (e.g. `/usr/local/go/bin`).
2. Build:
   ```bash
   ~/go/bin/xcaddy build --with github.com/caddy-dns/cloudflare --output /tmp/caddy-cloudflare
   ```
3. Replace binary (Caddy must be stopped first):
   ```bash
   sudo systemctl stop caddy
   sudo cp /tmp/caddy-cloudflare /usr/bin/caddy
   sudo chmod 755 /usr/bin/caddy
   sudo systemctl start caddy
   ```

## Token Configuration

The Cloudflare API token is in:

- `/etc/systemd/system/caddy.service.d/cloudflare.conf`

Do not store the token in git. Caddy reads `CLOUDFLARE_API_TOKEN` from the environment for DNS-01 challenges.
