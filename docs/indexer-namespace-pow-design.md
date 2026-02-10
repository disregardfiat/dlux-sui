# Indexer Namespace & Proof-of-Work Gating Design

## Problem

The SUI indexer was burning cycles because it queried **the entire testnet** (`queryTransactionBlocks` with no filter) every 30 seconds. Testnet is highly active—hundreds of transactions per block—so we were processing a firehose of irrelevant events.

## Solution: Namespace Filtering (Implemented)

**Filter by package**: Use `queryEvents` with `MoveEventModule` filter so we only fetch events from our deployed package:

```typescript
query: {
  MoveEventModule: {
    package: process.env.SUI_PACKAGE_ID,  // e.g. 0x123...
    module: process.env.SUI_EVENT_MODULE  // default: metadata_pm,dapp_posting,ad_campaigns,ad_payments,ad_tracking (all 5 in package)
  }
}
```

**Behavior**:
- `SUI_PACKAGE_ID` not set → indexer **disabled** (no polling)
- `SUI_PACKAGE_ID` set → events from `{package}::{module}` for each module in `SUI_EVENT_MODULE` are fetched and processed (default: all 5 modules in the package)

This reduces load from "entire testnet" to "only our namespace."

## Future: Proof-of-Work Gating

**Concept**: "Free" processing for events matching our vanity/filter namespace; additional processing (e.g. cross-namespace, high-volume) requires proof-of-work to earn entries.

### Design Options

1. **Vanity namespace = free**
   - Events from `0xvanityFilter*` (our package) are processed for free
   - Other events require PoW solution in event payload

2. **PoW earns indexing slots**
   - Updaters submit PoW (e.g. hash with nonce meeting difficulty)
   - Valid PoW earns N "indexing credits" that can be spent on processing arbitrary events
   - Prevents spam: you must burn CPU to get your events indexed

3. **Tiered processing**
   - Tier 0: Our package events (free, always)
   - Tier 1: External events with valid PoW (limited rate)
   - Tier 2: Paid / priority queue

### Implementation Sketch

- Add `proofOfWork` field to event schema or HTTP ingestion
- Verifier: `hash(nonce + eventId + secret) < target`
- Credits stored in Dgraph or Redis, decremented on index
- Health check exposes: `freeSlotsUsed`, `powSlotsUsed`, `creditsRemaining`

## Health Checks: What the System Provides

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic liveness |
| `GET /health/detailed` | Indexer stats, namespace filter, capabilities |

### sui-service `/health/detailed`

```json
{
  "status": "ok",
  "indexer": {
    "lastPollAt": "2026-02-01T19:00:00.000Z",
    "lastEventId": "txDigest:eventSeq",
    "eventsProcessed": 42,
    "filterInUse": "MoveEventModule(0x123::metadata_pm)",
    "packageId": "0x123...",
    "isRunning": true
  },
  "capabilities": {
    "namespaceFilter": true,
    "packageId": "0x123...",
    "eventModule": "metadata_pm"
  }
}
```

### dgraph-service `/health/detailed`

```json
{
  "status": "ok",
  "capabilities": {
    "blockchainIndexerEnabled": false,
    "blockchainIndexerPollInterval": "30000"
  }
}
```

## Next Steps for Running Better

1. **Deploy contracts** → get package ID → set `SUI_PACKAGE_ID` on server
2. **Disable dgraph blockchain indexer** if not needed: `BLOCKCHAIN_INDEXER_ENABLED=false`
3. **Increase poll interval** if load is low: `POLL_INTERVAL=120000` (2 min)
4. **Monitor** `/health/detailed` to confirm filter is active and events processed
5. **PoW gating** (future): implement when cross-namespace or high-volume indexing is needed
