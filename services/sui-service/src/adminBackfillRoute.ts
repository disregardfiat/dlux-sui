import type { Express } from 'express';
import { logger } from './utils/logger';
import { suiClient } from './sui/client';
import { indexer } from './sui/indexer';
import { dappRepository } from './repositories/dappRepository';

export function registerAdminBackfill(app: Express): void {
  app.get('/admin/backfill-tx', async (req, res) => {
    if (process.env.ALLOW_ADMIN_BACKFILL !== '1') {
      return res.status(403).json({ error: 'Set ALLOW_ADMIN_BACKFILL=1 to use this endpoint' });
    }
    const txDigest = (req.query.txDigest as string)?.trim();
    if (!txDigest) {
      return res.status(400).json({ error: 'Missing query param: txDigest' });
    }
    try {
      const client = suiClient.getClient();
      const tx = await client.getTransactionBlock({
        digest: txDigest,
        options: { showEvents: true }
      });
      if (tx.errors?.length) {
        return res.status(400).json({ error: 'Transaction has errors', details: tx.errors });
      }
      const events = tx.events ?? [];
      const { processed } = await indexer.processEventsFromTx(events);
      res.json({ ok: true, txDigest, eventsInTx: events.length, processed });
    } catch (err) {
      logger.error('Admin backfill-tx failed', { txDigest, error: err });
      res.status(500).json({ error: err instanceof Error ? err.message : 'Backfill failed' });
    }
  });

  app.post('/admin/backfill-chain', async (req, res) => {
    if (process.env.ALLOW_ADMIN_BACKFILL !== '1') {
      return res.status(403).json({ error: 'Set ALLOW_ADMIN_BACKFILL=1 to use this endpoint' });
    }
    try {
      const beforeCount = (await dappRepository.findAll(1000, 0)).length;
      await (indexer as any).backfillRecentEvents();
      const afterCount = (await dappRepository.findAll(1000, 0)).length;
      res.json({ 
        ok: true, 
        beforeCount, 
        afterCount, 
        added: afterCount - beforeCount 
      });
    } catch (err) {
      logger.error('Admin backfill-chain failed', { error: err });
      res.status(500).json({ error: err instanceof Error ? err.message : 'Backfill failed' });
    }
  });
}
