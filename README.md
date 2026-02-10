# DLUX-SUI

Decentralized metaverse platform built on SUI blockchain, enabling users to create, share, and interact with decentralized applications (dApps) and content.

## Overview

DLUX-SUI is a comprehensive platform that combines:
- **SUI Blockchain**: For dApp registration and authentication
- **Walrus Storage**: Decentralized blob storage for content
- **DGraph**: GraphQL API for contextualized data and search
- **Prediction Markets**: Decentralized moderation system
- **WebRTC**: Real-time communication and presence
- **Vue.js Frontend**: Modern web interface

## Key Features

- **SuiNS Names**: Register readable names for profile URLs
- **dApp Publishing**: Upload web apps, videos, audio, podcasts, livestreams
- **Safety Reviews**: Prediction markets for content moderation
- **Ad Network**: Promote posts and dApps with verification and community feedback
- **PWA Support**: All dApps are installable as Progressive Web Apps
- **Real-time Communication**: WebRTC for voice, video, and presence
- **ZK Account Linking**: Link GitHub, Gmail, Facebook accounts

## Quick Start

See [docs/architecture-overview.md](docs/architecture-overview.md) for detailed architecture, schemas, and customer journeys.

### Prerequisites

- Node.js 18+
- SUI wallet
- Docker (optional, for local development)

### Installation

```bash
# Install dependencies
npm install

# Build shared types
cd shared/types && npm install && npm run build

# Start services (development)
cd services/sui-service && npm install && npm run dev
cd services/walrus-service && npm install && npm run dev
cd services/dgraph-service && npm install && npm run dev
cd services/presence-service && npm install && npm run dev
cd frontend/sandbox && npm install && node index.js
cd frontend/vue-app && npm install && npm run dev
```

## Documentation

- [Architecture Overview](docs/architecture-overview.md) - Complete system architecture, schemas, and customer journeys
- [Architecture Cohesion](docs/architecture-cohesion.md) - API spec as source of truth; social and off-chain flows through DGraph; E2E validates spec
- [API Spec](docs/api/README.md) - OpenAPI for DGraph (social, markets, governance, subscription, location, ads)
- [Architecture Improvements](docs/architecture-improvements.md) - Improvements, QoL enhancements, and meta development hooks
- [Test Environment](docs/test-environment.md) - Server configuration and deployment
- [Sandbox Service](docs/sandbox-service.md) - dApp sandboxing and PWA generation
- [Moderation System](docs/moderation-system.md) - Prediction markets for safety reviews
- [Ad Network](docs/ad-network.md) - Ad network system for content promotion
- [SuiNS Names](docs/suins-names.md) - SuiNS identity documentation
- [Cloudflare DNS Setup](docs/cloudflare-dns-setup.md) - SSL certificate management

## Project Structure

```
dlux-sui/
├── services/           # Backend microservices
│   ├── sui-service/    # SUI blockchain integration
│   ├── walrus-service/ # Blob storage
│   ├── dgraph-service/ # GraphQL API, markets & governance
│   ├── presence-service/# WebRTC and presence
│   └── ad-service/     # Ad network (planned)
├── frontend/           # Frontend applications
│   ├── vue-app/        # Main Vue.js frontend
│   └── sandbox/        # Sandbox service for dApps
├── shared/             # Shared code
│   └── types/          # TypeScript type definitions
└── infrastructure/     # Deployment configs
    ├── docker-compose.yml
    └── kubernetes/
```

## URL Structure

- **Account**: `https://dlux.io/@yourname` or `https://dlux.io/@0xabc123...`
- **dApp**: `https://yourname.walrus.dlux.io/your-dapp`

## Development

See individual service READMEs for development instructions.

### MCP (Model Context Protocol)

MCP servers (SSH, GitHub, Browser) use env vars from `.env`. Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
# Edit .env with your SSH_HOST, SSH_KEY_PATH, GITHUB_PERSONAL_ACCESS_TOKEN, etc.
```

## License

MIT
