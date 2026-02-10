import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { suiClient } from './sui/client';
import { indexer } from './sui/indexer';
import { authRouter } from './routes/auth';
import { objectsRouter } from './routes/objects';
import { dappsRouter } from './routes/dapps';
import { vanityRouter } from './routes/vanity';
import { nftsRouter } from './routes/nfts';
import { suinsRouter } from './routes/suins';
import { billingRouter } from './routes/billing';
import adsRouter from './routes/ads';
import walrusNodesRouter from './routes/walrusNodes';
import { governanceRouter } from './routes/governance';
import { walrusDrawdownScheduler } from './services/walrusDrawdownScheduler';
import { registerAdminBackfill } from './adminBackfillRoute';

dotenv.config();

const app = express();
// Force PORT to 3001 - Caddy routes sui.dlux.io to this port
const PORT = parseInt(process.env.PORT || '3001', 10);
if (PORT !== 3001) {
  logger.warn(`PORT environment variable is set to ${PORT}, but sui-service must run on 3001 for Caddy routing. Overriding to 3001.`);
}
const ACTUAL_PORT = 3001;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}));
app.use(cors({
  origin: true, // Allow all origins (Caddy handles security)
  credentials: true // Allow credentials (cookies, auth headers)
}));
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/objects', objectsRouter);
app.use('/dapps', dappsRouter);
app.use('/vanity', vanityRouter);
app.use('/nfts', nftsRouter);
app.use('/suins', suinsRouter);
app.use('/billing', billingRouter);
app.use('/ads', adsRouter);
app.use('/walrus/nodes', walrusNodesRouter);
app.use('/governance', governanceRouter);

// Health check - basic
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Enriched health - indexer stats, namespace filter, system capabilities
app.get('/health/detailed', (req, res) => {
  const indexerStats = indexer.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    indexer: indexerStats,
    capabilities: {
      namespaceFilter: !!process.env.SUI_PACKAGE_ID,
      packageId: process.env.SUI_PACKAGE_ID || null,
      eventModule: process.env.SUI_EVENT_MODULE || 'metadata_pm',
      indexerMode: process.env.INDEXER_MODE === 'stream' ? 'stream' : 'poll'
    }
  });
});

registerAdminBackfill(app);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export app for testing
export { app };

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(ACTUAL_PORT, async () => {
    logger.info(`SUI Service listening on port ${ACTUAL_PORT}`);

    try {
      // Initialize SUI client
      await suiClient.connect();
      logger.info('Connected to SUI network');

      // Start indexer (only runs if SUI_PACKAGE_ID is set; non-blocking)
      indexer.start().catch(err => logger.error('Indexer failed to start', err));

      // Start Walrus drawdown scheduler (off-chain batch processing)
      const drawdownInterval = parseInt(process.env.WALRUS_DRAWDOWN_INTERVAL || '3600000', 10);
      if (process.env.WALRUS_DRAWDOWN_ENABLED !== 'false') {
        walrusDrawdownScheduler.start(drawdownInterval);
        logger.info('Walrus drawdown scheduler started', { intervalMs: drawdownInterval });
      }
    } catch (error) {
      logger.error('Failed to initialize SUI service', error);
      process.exit(1);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await indexer.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await indexer.stop();
  process.exit(0);
});