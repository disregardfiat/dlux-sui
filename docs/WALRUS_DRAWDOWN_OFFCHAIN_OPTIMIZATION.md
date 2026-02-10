# Walrus Drawdown: Off-Chain Optimization Proposal

## Current On-Chain Approach (Gas Analysis)

### Current Implementation
Each `walrus_drawdown` call performs:
- 1 Move call to `walrus_drawdown` function
- 3 balance splits (`balance::split`)
- 3 coin transfers (`transfer::public_transfer`)
- Event emission
- Gas paid by admin account

### Gas Cost Estimate
- **Base transaction**: ~1,000-2,000 MIST
- **Balance splits**: ~500-1,000 MIST each (3 splits = ~1,500-3,000 MIST)
- **Transfers**: ~200-500 MIST each (3 transfers = ~600-1,500 MIST)
- **Move call overhead**: ~500-1,000 MIST
- **Total per drawdown**: ~3,600-7,500 MIST (~0.0000036-0.0000075 SUI)

**For 100 drawdowns/day**: ~0.00036-0.00075 SUI/day (~$0.0001-0.0002/day at $0.30/SUI)

**For 10,000 drawdowns/day**: ~0.036-0.075 SUI/day (~$0.01-0.02/day)

### Issues with Current Approach
1. **Gas costs accumulate** with high volume
2. **Admin account must pay gas** for every drawdown
3. **No batching** - each drawdown is a separate transaction
4. **Complex contract logic** for simple transfers

## Proposed Off-Chain Approach

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│  Scheduled Service (cron/scheduler)                     │
│  - Runs every N hours (configurable)                     │
│  - Queries DGraph for pending drawdowns                   │
│  - Calculates splits off-chain                           │
│  - Batches multiple drawdowns                            │
│  - Deposits directly from service SUI account             │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  DGraph: Pending Drawdowns Queue                        │
│  - proofHash, contentId, amount, verified               │
│  - walrusDrawdownUsed = false                            │
│  - walrusDrawdownPending = true (new field)               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Off-Chain Processing                                    │
│  1. Query pending drawdowns                              │
│  2. Verify proofs (Merkle/ZK)                          │
│  3. Check PM status                                      │
│  4. Calculate splits (10%, 9%, 81%)                     │
│  5. Batch by recipient                                  │
│  6. Execute simple SUI transfers                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Simple SUI Transfers (gas-optimized)                    │
│  - Batch transfers to same recipient                     │
│  - Use Transaction.splitCoins + transferObjects         │
│  - Single transaction per recipient                      │
└─────────────────────────────────────────────────────────┘
```

### Benefits

1. **Lower Gas Costs**
   - Simple transfers instead of complex Move calls
   - Batch multiple drawdowns into fewer transactions
   - Gas paid from service account (can be optimized)

2. **Better Scalability**
   - Process thousands of drawdowns in batches
   - Single transaction per recipient (aggregate amounts)
   - No per-drawdown transaction overhead

3. **Simpler Logic**
   - Off-chain calculation (easier to debug/modify)
   - No contract changes needed
   - Can adjust splits without contract upgrade

4. **Automated Processing**
   - Scheduled runs (hourly/daily)
   - Automatic batching
   - Retry logic for failed transfers

### Implementation

#### 1. New DGraph Field
```dql
type AdImpression {
  # ... existing fields ...
  walrusDrawdownPending: bool @index(bool) # true when queued for drawdown
  walrusDrawdownPendingAt: datetime @index(hour) # when queued
}
```

#### 2. Queue Drawdown Endpoint
```typescript
POST /ads/walrus/queue-drawdown
{
  "contentId": "dapp_123",
  "verifiedProofs": ["hash1", "hash2"],
  "amount": 1000000000
}

// Response: { queued: true, queueId: "..." }
// Marks proofs as walrusDrawdownPending = true
```

#### 3. Scheduled Service
```typescript
// services/sui-service/src/services/walrusDrawdownScheduler.ts

export class WalrusDrawdownScheduler {
  async processPendingDrawdowns() {
    // 1. Query DGraph for pending drawdowns
    const pending = await dgraphService.getPendingDrawdowns();
    
    // 2. Group by recipient (walrus, foundation, creator/pm)
    const batches = this.groupByRecipient(pending);
    
    // 3. For each recipient, create single transfer transaction
    for (const [recipient, drawdowns] of batches) {
      const totalAmount = drawdowns.reduce((sum, d) => sum + d.amount, 0);
      await this.transferToRecipient(recipient, totalAmount, drawdowns);
    }
    
    // 4. Mark proofs as used
    await dgraphService.markDrawdownsCompleted(pending.map(d => d.proofHash));
  }
  
  private groupByRecipient(drawdowns: PendingDrawdown[]) {
    const batches = new Map<string, PendingDrawdown[]>();
    
    for (const drawdown of drawdowns) {
      // Calculate splits
      const walrusShare = Math.floor(drawdown.amount * 0.10);
      const foundationShare = Math.floor(drawdown.amount * 0.09);
      const recipientShare = Math.floor(drawdown.amount * 0.81);
      
      // Determine recipient (PM pool or creator)
      const recipient = drawdown.pmActive ? PM_POOL_ADDRESS : drawdown.creator;
      
      // Add to batches
      this.addToBatch(batches, WALRUS_PROVIDER_ADDRESS, { ...drawdown, share: walrusShare });
      this.addToBatch(batches, FOUNDATION_ADDRESS, { ...drawdown, share: foundationShare });
      this.addToBatch(batches, recipient, { ...drawdown, share: recipientShare });
    }
    
    return batches;
  }
  
  private async transferToRecipient(
    recipient: string,
    totalAmount: bigint,
    drawdowns: PendingDrawdown[]
  ) {
    const tx = new Transaction();
    
    // Split from gas coin (or use existing coins)
    const [coin] = tx.splitCoins(tx.gas, [totalAmount]);
    tx.transferObjects([coin], recipient);
    
    // Execute transaction
    await suiClient.signAndExecuteTransaction({
      signer: serviceKeypair,
      transaction: tx
    });
    
    logger.info('Batch transfer completed', {
      recipient,
      amount: totalAmount.toString(),
      drawdownCount: drawdowns.length
    });
  }
}
```

#### 4. Scheduler Integration
```typescript
// services/sui-service/src/index.ts

import { walrusDrawdownScheduler } from './services/walrusDrawdownScheduler';

// Run every hour (configurable)
const DRAWDOWN_INTERVAL = parseInt(process.env.WALRUS_DRAWDOWN_INTERVAL || '3600000', 10);

setInterval(async () => {
  try {
    await walrusDrawdownScheduler.processPendingDrawdowns();
  } catch (error) {
    logger.error('Error processing pending drawdowns', error);
  }
}, DRAWDOWN_INTERVAL);

// Run immediately on startup (optional)
walrusDrawdownScheduler.processPendingDrawdowns().catch(err => {
  logger.error('Error in initial drawdown processing', err);
});
```

### Gas Cost Comparison

#### Current (On-Chain)
- **Per drawdown**: ~3,600-7,500 MIST
- **100 drawdowns**: ~360,000-750,000 MIST (~0.00036-0.00075 SUI)
- **10,000 drawdowns**: ~36,000,000-75,000,000 MIST (~0.036-0.075 SUI)

#### Proposed (Off-Chain)
- **Per recipient batch**: ~2,000-3,000 MIST (simple transfer)
- **100 drawdowns** (3 recipients): ~6,000-9,000 MIST (~0.000006-0.000009 SUI)
- **10,000 drawdowns** (3 recipients): ~6,000-9,000 MIST (~0.000006-0.000009 SUI)

**Savings**: ~99% reduction in gas costs for high-volume scenarios

### Migration Path

1. **Phase 1**: Add off-chain scheduler alongside existing endpoint
   - Keep `POST /ads/walrus/drawdown` for immediate needs
   - Add `POST /ads/walrus/queue-drawdown` for queued processing
   - Add scheduler service

2. **Phase 2**: Monitor and optimize
   - Compare gas costs
   - Adjust batch sizes
   - Optimize transfer logic

3. **Phase 3**: Deprecate on-chain endpoint (optional)
   - If off-chain proves more efficient
   - Keep contract function for emergency/backup

### Configuration

```bash
# Environment variables
WALRUS_DRAWDOWN_INTERVAL=3600000  # 1 hour in ms
WALRUS_DRAWDOWN_BATCH_SIZE=100    # Max drawdowns per batch
WALRUS_DRAWDOWN_ENABLED=true      # Enable scheduler
WALRUS_DRAWDOWN_SERVICE_ADDRESS=0x...  # Service account for transfers
WALRUS_DRAWDOWN_SERVICE_PRIVATE_KEY=... # Service account private key
```

### Security Considerations

1. **Service Account Security**
   - Use dedicated account for drawdowns
   - Limit balance (auto-refill from main account)
   - Monitor for unusual activity

2. **Double-Spend Prevention**
   - Still mark proofs as `walrusDrawdownUsed` after transfer
   - Check `walrusDrawdownPending` before queuing
   - Idempotent transfer logic

3. **Audit Trail**
   - Log all drawdowns processed
   - Store transaction digests
   - Track batch processing times

4. **Failure Handling**
   - Retry failed transfers
   - Alert on repeated failures
   - Manual override capability

### Monitoring

```typescript
// Metrics to track
- Pending drawdowns count
- Batch processing time
- Transfer success rate
- Gas costs per batch
- Average drawdowns per batch
```

## Recommendation

**Implement the off-chain scheduler approach** because:

1. **Significant gas savings** (99% reduction for high volume)
2. **Better scalability** (batch processing)
3. **Simpler logic** (off-chain calculations)
4. **Automated** (no manual intervention needed)
5. **Flexible** (easy to adjust splits/parameters)

The on-chain contract function can remain as a **backup/emergency** option, but the primary flow should use the scheduled off-chain service.
