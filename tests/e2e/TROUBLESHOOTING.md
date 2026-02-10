# E2E Test Troubleshooting

## Port Conflicts

If you see `EADDRINUSE: address already in use` errors, a port is already occupied.

### Check What's Using Ports

```bash
# Check port 3003 (DGraph Service)
lsof -i :3003
# OR
ss -tlnp | grep :3003

# Check port 3002 (Walrus Service)
lsof -i :3002

# Check port 3001 (SUI Service)
lsof -i :3001
```

### Free Ports

If you have sudo access:
```bash
sudo fuser -k 3003/tcp
sudo fuser -k 3002/tcp
sudo fuser -k 3001/tcp
```

Without sudo, you'll need to manually stop the process using the port or use different ports via environment variables:

```bash
PORT=3004 cd services/dgraph-service && npm run dev
PORT=3005 cd services/walrus-service && npm run dev
PORT=3006 cd services/sui-service && npm run dev
```

Then update the E2E test environment variables:
```bash
export DGRAPH_SERVICE_URL=http://localhost:3004
export WALRUS_SERVICE_URL=http://localhost:3005
export SUI_SERVICE_URL=http://localhost:3006
```

## DGraph Server Not Running

The dgraph-service can run without DGraph server (uses in-memory mode), but for full functionality you need DGraph running.

### Start DGraph (if available)

```bash
# Using Docker
docker run -d -p 8080:8080 -p 9080:9080 dgraph/standalone:latest

# Or use your DGraph installation
```

The service will automatically detect if DGraph is available and use it, or fall back to in-memory mode.

## Services Not Starting

1. **Check dependencies**: `npm install` in each service directory
2. **Check environment variables**: Each service has an `env.example` file
3. **Check logs**: Look at the terminal output for specific errors
4. **Check ports**: Ensure ports are free (see Port Conflicts above)

## Health Check Returns HTML Instead of JSON

If health checks return HTML, something else is running on that port. This usually means:
- Another service is using the port
- A reverse proxy is intercepting requests
- The service failed to start but something else is on the port

**Solution**: Free the port or use a different port (see Port Conflicts above).
