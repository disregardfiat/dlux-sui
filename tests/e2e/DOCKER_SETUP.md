# Running E2E Tests with Docker

This guide explains how to run E2E tests against services running in Docker containers.

## Quick Start

1. **Start services in Docker:**
   ```bash
   npm run docker:e2e
   # OR
   cd infrastructure && ./scripts/start-services.sh --e2e
   ```

2. **Wait for services to be healthy:**
   ```bash
   npm run test:e2e:check
   ```

3. **Run E2E tests:**
   ```bash
   npm run test:e2e
   ```

4. **Stop services:**
   ```bash
   npm run docker:down
   # OR
   cd infrastructure && ./scripts/stop-services.sh
   ```

## Benefits of Docker Setup

- ✅ **No port conflicts**: Services run in isolated containers
- ✅ **Consistent environment**: Same setup across all developers
- ✅ **Easy cleanup**: Stop and remove containers when done
- ✅ **Production-like**: Similar to deployment environment
- ✅ **Network isolation**: Services communicate on private Docker network

## Service URLs

When services run in Docker, they're accessible on localhost:

- **SUI Service**: http://localhost:3001
- **Walrus Service**: http://localhost:3002
- **DGraph Service**: http://localhost:3003

Inside the Docker network, services use service names:
- `http://sui-service:3001`
- `http://walrus-service:3002`
- `http://dgraph-service:3003`

## Troubleshooting

### Services Not Starting

```bash
# Check logs
cd infrastructure
docker-compose logs -f dgraph-service
docker-compose logs -f walrus-service
docker-compose logs -f sui-service

# Check service status
docker-compose ps
```

### Port Conflicts

If ports are still in use:
1. Check what's using them: `lsof -i :3001 -i :3002 -i :3003`
2. Stop conflicting services
3. Or use override file to change ports (see infrastructure/README.md)

### Services Not Healthy

```bash
# Check health endpoints manually
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health

# Restart services
cd infrastructure
docker-compose restart
```

### DGraph Connection Issues

If DGraph service can't connect to DGraph database:
- Service will automatically use in-memory mode
- Check DGraph logs: `docker-compose logs dgraph-alpha`
- Service will work for E2E tests even without DGraph database

## Development vs E2E Mode

- **Full mode** (`docker-compose up`): Starts all services including DGraph database
- **E2E mode** (`docker-compose -f docker-compose.yml -f docker-compose.e2e.yml up`): Starts only essential services for testing

## Viewing Logs

```bash
# All services
npm run docker:logs

# Specific service
cd infrastructure
docker-compose logs -f dgraph-service
docker-compose logs -f walrus-service
docker-compose logs -f sui-service
```

## Cleanup

```bash
# Stop services
npm run docker:down

# Stop and remove volumes (deletes DGraph data)
cd infrastructure
docker-compose down -v
```
