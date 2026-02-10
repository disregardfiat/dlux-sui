import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { walrusClient } from './walrus/client';
import { sealClient } from './seal/client';
import { blobRouter } from './routes/blobs';
import { adsRouter } from './routes/ads';
import { premiumRouter } from './routes/premium';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}));
app.use(cors({
  origin: true, // Allow all origins (Caddy handles security)
  credentials: true // Allow credentials (cookies, auth headers)
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/blobs', blobRouter);
app.use('/ads', adsRouter);
app.use('/premium', premiumRouter);

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
  const server = app.listen(PORT, () => {
    logger.info(`Walrus Service listening on port ${PORT}`);

    // Initialize clients asynchronously (don't block server startup)
    (async () => {
      // Initialize Walrus client (optional - service can run without it)
      try {
        await walrusClient.connect();
        logger.info('Connected to Walrus storage');
      } catch (error) {
        logger.warn('Walrus network not available - service will run in test mode');
        logger.warn('To use Walrus: set WALRUS_BASE_URL or ensure network is accessible');
        logger.warn('This is OK for development/testing');
      }

      // Initialize Seal client (optional - service can run without it)
      try {
        await sealClient.connect();
        logger.info('Connected to Seal encryption service');
      } catch (error) {
        logger.warn('Seal service not available - premium content encryption disabled');
        logger.warn('To use Seal: set SEAL_BASE_URL or ensure service is accessible');
        logger.warn('This is OK for development/testing');
      }
    })().catch((error) => {
      logger.error('Error initializing clients', error);
      // Don't exit - server is already running
    });
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Please free the port or set a different PORT environment variable.`);
      logger.error(`To find what's using port ${PORT}: lsof -i :${PORT} or ss -tlnp | grep :${PORT}`);
      process.exit(1);
    } else {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await walrusClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await walrusClient.disconnect();
  process.exit(0);
});