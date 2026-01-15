# Caddy Webhook Configuration

Add the following to `/etc/caddy/Caddyfile`:

```caddy
webhook.dlux.io {
    reverse_proxy localhost:3008
}
```

Then reload Caddy:
```bash
sudo systemctl reload caddy
```

Or test the configuration first:
```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```
