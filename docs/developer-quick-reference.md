# Developer Quick Reference

Quick reference guide for common development tasks and workflows.

## Quick Start

```bash
# Install all dependencies
npm install

# Start all services in development mode
npm run dev:all

# Or start individual services
cd services/sui-service && npm run dev
```

## Common Tasks

### Generate New Service

```bash
# Generate a new service with all boilerplate
npm run generate:service -- --name my-service --port 3010 --type rest

# This creates:
# - services/my-service/ with full structure
# - Updates architecture docs
# - Creates Docker config
# - Generates Kubernetes manifests
```

### Generate API Client

```bash
# Generate typed API clients for all services
npm run generate:clients

# Clients available in shared/clients/
```

### Database Migrations

```bash
# Generate migration from schema changes
npm run migrate:generate -- --name add_user_table

# Run migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Seed database
npm run migrate:seed
```

### Testing

```bash
# Run all tests
npm test

# Run tests for specific service
cd services/sui-service && npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage
npm run test:coverage
```

### Code Quality

```bash
# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check

# Format code
npm run format

# Run all quality checks
npm run quality
```

### Documentation

```bash
# Generate API documentation
npm run docs:api

# Generate architecture diagrams
npm run docs:diagrams

# Update all documentation
npm run docs:update
```

### Deployment

```bash
# Build all services
npm run build

# Deploy to staging
npm run deploy -- --env staging

# Deploy to production
npm run deploy -- --env production

# Validate deployment
npm run deploy:validate -- --env production
```

## Service Development

### Creating a New Endpoint

1. Define schema in `shared/schemas/`
2. Generate types: `npm run generate:types`
3. Create route in `services/{service}/src/routes/`
4. Create service method in `services/{service}/src/services/`
5. Add tests in `services/{service}/tests/`
6. Documentation auto-updates

### Adding a New Service

1. Generate service: `npm run generate:service -- --name {name}`
2. Define schemas in `shared/schemas/`
3. Implement routes and services
4. Add integration tests
5. Update architecture docs (auto-generated)

## Debugging

### Local Development

```bash
# Start with debug logging
npm run dev:debug

# Start development dashboard
npm run dev:dashboard

# View logs for specific service
npm run logs -- --service sui-service
```

### Testing Locally

```bash
# Start services with mock data
npm run dev:mock

# Run integration tests
npm run test:integration

# Test specific API endpoint
curl http://localhost:3001/health
```

## Environment Management

### Switching Environments

```bash
# Use staging environment
npm run env:use -- --env staging

# Use production environment
npm run env:use -- --env production

# Validate environment config
npm run env:validate
```

### Environment Variables

```bash
# List all environment variables
npm run env:list

# Validate .env file
npm run env:validate

# Generate .env.example
npm run env:generate
```

## Common Patterns

### Adding a New Feature

1. **Define Schema**: Add to `shared/schemas/`
2. **Generate Types**: `npm run generate:types`
3. **Implement Service**: Add routes and services
4. **Add Tests**: Write unit and integration tests
5. **Update Docs**: Documentation auto-updates
6. **Deploy**: Use deployment pipeline

### Adding a New Integration

1. **Create Client**: Generate API client
2. **Add Service**: Create integration service
3. **Add Tests**: Mock external service
4. **Add Retry Logic**: Handle failures
5. **Add Monitoring**: Track integration health

### Debugging Issues

1. **Check Logs**: `npm run logs -- --service {service}`
2. **Check Health**: `curl http://localhost:{port}/health`
3. **Check Metrics**: Open Grafana dashboard
4. **Check Traces**: Open Jaeger UI
5. **Check Database**: Connect to database

## Useful Commands

```bash
# Clean all build artifacts
npm run clean

# Reset development environment
npm run dev:reset

# Check service dependencies
npm run deps:check

# Update all dependencies
npm run deps:update

# Security audit
npm audit

# Fix security issues
npm audit fix
```

## Service Ports

- **3001**: SUI Service
- **3002**: Walrus Service
- **3003**: DGraph Service (GraphQL)
- **3004-3005**: Presence Service
- **3006**: Vue Frontend
- **3007**: Sandbox Service
- **3008**: PM Service
- **3009**: Ad Service (planned)

## Useful URLs

- **Frontend**: http://localhost:3006
- **GraphQL Playground**: http://localhost:3003/graphql
- **API Docs**: http://localhost:3001/docs (Swagger)
- **Dev Dashboard**: http://localhost:3010 (planned)
- **Grafana**: http://localhost:3000 (planned)
- **Jaeger**: http://localhost:16686 (planned)

## Troubleshooting

### Service Won't Start

1. Check if port is already in use
2. Check environment variables
3. Check service dependencies are running
4. Check logs: `npm run logs -- --service {service}`

### Tests Failing

1. Check database is running
2. Check test data is seeded
3. Check environment variables
4. Run tests in isolation: `npm test -- --isolate`

### Build Failing

1. Check TypeScript errors: `npm run type-check`
2. Check linting errors: `npm run lint`
3. Clean and rebuild: `npm run clean && npm run build`

## Getting Help

- **Documentation**: See `docs/` directory
- **Architecture**: See `docs/architecture-overview.md`
- **Improvements**: See `docs/architecture-improvements.md`
- **API Docs**: Generated Swagger/OpenAPI docs
- **Code Examples**: See `examples/` directory (planned)
