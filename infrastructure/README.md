# DLUX-SUI Infrastructure

Docker Compose configuration for running all DLUX-SUI services locally.

## Quick Start

### Default (Testnet)
```bash
docker-compose up -d
```

### Devnet
```bash
docker-compose -f docker-compose.yml -f docker-compose.devnet.yml up -d
```

### Mainnet
```bash
docker-compose -f docker-compose.yml -f docker-compose.mainnet.yml up -d
```

## SUI Network Configuration

The `sui-service` can connect to different Sui networks:

- **Testnet** (default): `https://fullnode.testnet.sui.io`
- **Devnet**: `https://fullnode.devnet.sui.io`
- **Mainnet**: `https://fullnode.mainnet.sui.io`

### Testnet Deployment with Streaming

To run sui-service on testnet and **stream events** (WebSocket) instead of polling:

1. **Deploy your contracts** to testnet and note the package ID.
2. **Set `SUI_PACKAGE_ID`** (required—indexer is disabled without it):

   ```bash
   export SUI_PACKAGE_ID=0x123...   # Your deployed package ID
   export INDEXER_MODE=stream        # stream = WebSocket (default); poll = queryEvents
   docker-compose -f docker-compose.yml -f docker-compose.testnet.yml up -d
   ```

3. **Verify** at `http://localhost:3001/health/detailed`:
   - `indexer.mode`: `stream` or `poll`
   - `indexer.filterInUse`: `MoveEventModule(0x123...::metadata_pm)`

Streaming uses `subscribeEvent` over WebSocket—lower CPU and events arrive as they occur.

### Environment Variables

Set these in your `.env` file or override files:

```bash
# Network selection
SUI_NETWORK=testnet  # testnet, devnet, or mainnet

# RPC URLs (auto-set based on SUI_NETWORK if not provided)
SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Faucet (testnet/devnet only)
SUI_FAUCET_URL=https://faucet.testnet.sui.io/gas

# Required for indexer: your deployed package ID
SUI_PACKAGE_ID=0x123...

# Indexer mode: stream (WebSocket) or poll (queryEvents)
INDEXER_MODE=stream
```

### Network-Specific Overrides

Use compose override files for different networks:

```bash
# Testnet
docker-compose -f docker-compose.yml -f docker-compose.testnet.yml up

# Devnet  
docker-compose -f docker-compose.yml -f docker-compose.devnet.yml up

# Mainnet (WARNING: Real SUI tokens!)
docker-compose -f docker-compose.yml -f docker-compose.mainnet.yml up
```

## Services

- **dgraph-zero/alpha**: DGraph database cluster
- **sui-service**: Blockchain operations (port 3001)
- **walrus-service**: Storage & premium content (port 3002)
- **dgraph-service**: Social data, markets & governance (port 3003)
- **zk-service**: ZK proofs (port 3010)
- **mcp-service**: AI assistant integration (port 3009)
- **vue-app**: Frontend (port 3000)

## Health Checks

All services include health check endpoints:
- `http://localhost:3001/health` - SUI Service
- `http://localhost:3002/health` - Walrus Service
- `http://localhost:3003/health` - DGraph Service
- etc.

## Volumes

- `dgraph_zero`: DGraph zero node data
- `dgraph_alpha`: DGraph alpha node data
- Service logs: Mounted from `../services/*/logs`

## Network

All services run on the `dlux-network` bridge network for internal communication.
