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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/objects', objectsRouter);
app.use('/dapps', dappsRouter);
app.use('/vanity', vanityRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export app for testing
export { app };

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    logger.info(`SUI Service listening on port ${PORT}`);

    try {
      // Initialize SUI client
      await suiClient.connect();
      logger.info('Connected to SUI network');

      // Start indexer
      await indexer.start();
      logger.info('SUI indexer started');
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