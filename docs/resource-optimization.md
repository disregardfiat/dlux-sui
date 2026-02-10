# DLUX-SUI Resource Optimization Guide

## Running the Resource Analysis

SSH into the server and run:

```bash
ssh -i /path/to/key ubuntu@157.180.53.238
cd ~/dlux-sui
./scripts/resource-analysis.sh
```

Or pipe remotely:

```bash
ssh -i /path/to/key ubuntu@157.180.53.238 'bash -s' < scripts/resource-analysis.sh
```

## Expected Resource Hogs (by typical usage)

| Service | Typical CPU | Typical Memory | Notes |
|---------|-------------|----------------|-------|
| **Dgraph (index)** | Low | **Moderate** (256MB–512MB) | Graph DB with LRU cache; `lru_mb=512` default (was 2048) |
| **dgraph-service** | Medium | Medium | Apollo Server + blockchain indexer polling |
| **sui-service** | Medium | Medium | SUI indexer polls every 30s, queries RPC |
| **presence-service** | Medium | **High** | Hocuspocus WebSocket + TURN + signaling |
| **walrus-service** | Low | **Spiky** | 50MB multer memoryStorage per upload |
| **vue-frontend** | Low | Low | Static serve |
| **webhook-service** | Low | Low | Event-driven |

## Hardware Sufficiency Checklist

- **RAM**: Sum of service memory should be < 80% of total. Dgraph alone often needs 2–4GB.
- **CPU**: Load average < number of cores under normal load.
- **Disk**: `/` and data volumes should have > 20% free.

## Optimization Recommendations

### 1. SUI Indexer – Namespace Filter (Critical)

**Current**: Indexer uses `queryEvents` with `MoveEventModule` filter—only events from your package are fetched.

**Required**: Set `SUI_PACKAGE_ID` to your deployed package ID. Without it, the indexer is **disabled** (we no longer poll the entire testnet).

```bash
# In service .env or PM2 env
SUI_PACKAGE_ID=0x123...   # Your deployed package ID
SUI_EVENT_MODULE=metadata_pm,dapp_posting,ad_campaigns,ad_payments,ad_tracking   # Modules to filter (default: all 5 in package)
```

### 2. SUI Indexer – Reduce Poll Frequency

**Change**: Increase `POLL_INTERVAL` for lower activity:

```bash
POLL_INTERVAL=120000   # 2 minutes instead of 30s
```

**Code**: `services/sui-service/src/sui/indexer.ts` – uses `process.env.POLL_INTERVAL`.

### 3. Dgraph Blockchain Indexer – Disable or Slow Down

**Current**: Disabled by default (`BLOCKCHAIN_INDEXER_ENABLED=false`); poll interval 5 min when enabled.

**Change**: Set `BLOCKCHAIN_INDEXER_ENABLED=true` in dgraph-service env when SUI sync is needed. Poll interval is `BLOCKCHAIN_INDEXER_POLL_INTERVAL=300000` (5 min).

### 3. Walrus Service – Stream Large Uploads to Disk

**Current**: `multer.memoryStorage()` holds entire 50MB file in RAM per upload.

**Change**: Use disk storage for large files:

```javascript
// services/walrus-service/src/routes/blobs.ts
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  storage: multer.diskStorage({
    destination: '/tmp/walrus-uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  })
});
// Then read from disk when storing to Walrus, delete after
```

### 5. Dgraph Alpha – Tune LRU Cache

**Current**: `--lru_mb=512` (512MB) in docker-compose (reduced from 2048 for light usage).

**Change**: If processing heavy workloads, increase:

```yaml
command: dgraph alpha --my=dgraph-alpha:7080 --zero=dgraph-zero:5080 --lru_mb=1024
```

### 6. Node.js Memory Limits

Add `NODE_OPTIONS` to cap heap for Node services:

```bash
# In PM2 ecosystem or .env
NODE_OPTIONS=--max-old-space-size=512   # 512MB per Node process
```

### 7. PM2 Cluster Mode (Optional)

For CPU-bound services, use cluster mode to spread load:

```bash
pm2 start dist/index.js -i 1 --name sui-service -- 3001
# -i 1 = one instance; increase for multi-core
```

### 8. Presence Service – TURN/WebSocket Limits

If TURN/WebSocket usage is low, consider:
- Reducing TURN relay allocation
- Adding connection limits in Hocuspocus
- Moving TURN to a dedicated STUN/TURN provider (e.g. Twilio) to offload

## Quick Wins Summary

| Action | Effort | Impact |
|--------|--------|--------|
| Set `SUI_PACKAGE_ID` (required for indexer) | Low | Only process your namespace; indexer disabled without it |
| Set `POLL_INTERVAL=120000` for sui-service | Low | Lower CPU from indexer |
| Disable or slow blockchain indexer in dgraph-service | Low | Lower CPU |
| Switch Walrus to disk storage for uploads | Medium | Avoid memory spikes |
| Reduce Dgraph `lru_mb` if RAM tight | Low | Lower memory |
| Add `NODE_OPTIONS=--max-old-space-size=512` | Low | Prevent runaway memory |
