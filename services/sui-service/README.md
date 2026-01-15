# SUI Service

SUI blockchain integration service for indexing text objects and dApps with ZK authentication.

## Features

- **Text Object Indexing**: Monitors SUI blockchain for text objects and indexes them
- **dApp Registration**: Tracks user-generated dApps on the blockchain
- **ZK Authentication**: Zero-knowledge login with SUI wallet signatures
- **ZK Linking**: Link external identities (GitHub, Gmail, Facebook) via ZK proofs
- **REST API**: Full REST API for querying indexed data

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp env.example .env
# Edit .env with your configuration

# Build the service
npm run build

# Start the service
npm start

# Or run in development mode
npm run dev
```

## API Endpoints

### Authentication

- `POST /auth/challenge` - Generate authentication challenge
- `POST /auth/zk-login` - ZK login with SUI signature
- `POST /auth/zk-link` - Link external ZK proof
- `GET /auth/profile/:suiAddress` - Get user profile
- `POST /auth/verify` - Verify JWT token

### Text Objects

- `GET /objects` - Get all text objects (paginated)
- `GET /objects/:id` - Get text object by ID
- `GET /objects/owner/:suiAddress` - Get text objects by owner
- `GET /objects/search?q=query` - Search text objects
- `POST /objects` - Create text object (testing only)

### dApps

- `GET /dapps` - Get all dApps (paginated)
- `GET /dapps/:id` - Get dApp by ID
- `GET /dapps/owner/:suiAddress` - Get dApps by owner
- `GET /dapps/search?q=query&tags=tag1,tag2` - Search dApps
- `POST /dapps` - Create dApp (testing only)

## Environment Variables

See `env.example` for all available configuration options.

## Development

```bash
# Run tests
npm test

# Run linter
npm run lint

# Clean build
npm run clean
```

## Architecture

- **Indexer**: Polls SUI blockchain for events and indexes objects
- **Processors**: Handle different types of blockchain events
- **Repositories**: Data access layer (currently in-memory)
- **Services**: Business logic layer
- **Routes**: REST API endpoints

## ZK Authentication Flow

1. Client requests challenge from `/auth/challenge`
2. Client signs challenge with SUI wallet
3. Client sends signature to `/auth/zk-login`
4. Service verifies signature and issues JWT
5. Client can link external ZKs via `/auth/zk-link`

## Future Enhancements

- Real-time event subscription (when SUI supports it)
- Database persistence (PostgreSQL + Redis)
- Proper ZK proof verification for external providers
- Rate limiting and security enhancements