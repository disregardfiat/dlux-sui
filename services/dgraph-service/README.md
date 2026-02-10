# dGraph Service

GraphQL API service using dGraph for contextualizing SUI data and enabling searches.

## Features

- **GraphQL API**: Full GraphQL schema for querying SUI data and dApps
- **dGraph Integration**: Distributed graph database for complex relationships
- **Search Functionality**: Full-text search across text objects and dApps
- **Real-time Updates**: Live queries for dynamic data
- **Schema Management**: Automated schema updates and migrations

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp env.example .env
# Edit .env with your dGraph configuration

# Build the service
npm run build

# Start the service
npm start

# Or run in development mode
npm run dev
```

## GraphQL Schema

The service provides a comprehensive GraphQL schema with:

- **Users**: SUI addresses with ZK proofs
- **Text Objects**: Indexed SUI text objects
- **dApps**: User-generated decentralized applications
- **Search**: Full-text search and filtering
- **Relationships**: Complex relationships between entities

## Example Queries

### Get a user
```graphql
query GetUser($suiAddress: String!) {
  user(suiAddress: $suiAddress) {
    suiAddress
    linkedZKPs {
      provider
      linkedAt
    }
    createdAt
  }
}
```

### Search dApps
```graphql
query SearchDApps($query: String, $limit: Int) {
  searchDApps(query: $query, limit: $limit) {
    dapps {
      id
      name
      description
      owner
      tags
      rating
      downloadCount
    }
    total
    hasMore
  }
}
```

### Get trending dApps
```graphql
query TrendingDApps {
  trendingDApps(limit: 10) {
    id
    name
    rating
    downloadCount
  }
}
```

## Example Mutations

### Create a dApp
```graphql
mutation CreateDApp($input: CreateDAppInput!) {
  createDApp(input: $input) {
    id
    name
    owner
    createdAt
  }
}
```

## dGraph Setup

### Using Docker
```bash
# Start dGraph
docker run -it -p 8000:8000 -p 8080:8080 -p 9080:9080 -p 5080:5080 \
  -v ~/dgraph:/dgraph --name dgraph dgraph/dgraph:latest dgraph zero

# In another terminal
docker exec -it dgraph dgraph alpha --lru_mb 2048 --zero localhost:5080
```

### Schema Setup
The service will automatically set up the required schema when it starts.

## Environment Variables

See `env.example` for all available configuration options.

## Architecture

- **GraphQL Layer**: Apollo Server with schema and resolvers
- **Database Layer**: dGraph client for queries and mutations
- **Schema Management**: Automatic schema updates
- **Indexing**: Full-text search indexes for content

## Development

```bash
# Run tests
npm test

# Run linter
npm run lint

# Clean build
npm run clean

# GraphQL playground
# Visit http://localhost:3003/graphql when running
```

## Data Model

### Users
- SUI addresses with ZK authentication
- Linked external identities (GitHub, Gmail, Facebook)
- Profile information and preferences

### Text Objects
- Indexed SUI blockchain text objects
- Full-text search capabilities
- Metadata and relationships

### dApps
- Decentralized applications registry
- Manifests, permissions, and metadata
- Ratings, downloads, and categories
- Blob references for assets

## Search Features

- **Full-text search** across names, descriptions, and content
- **Tag-based filtering** for categorization
- **Owner filtering** for user-specific queries
- **Category filtering** for app discovery
- **Rating and popularity** sorting

## Future Enhancements

- Real-time subscriptions for live updates
- Advanced recommendation algorithms
- Social features (comments, reviews)
- Analytics and usage tracking
- Multi-language support
- Caching layer for performance
- Backup and recovery procedures