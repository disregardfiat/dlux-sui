import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { proofGenerator } from './services/proofGenerator';
import { homomorphicEncryption } from './services/homomorphicEncryption';
import proofsRouter from './routes/proofs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'zk-service',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/proofs', proofsRouter);

// Export app for testing
export { app };

async function startServer() {
  // Initialize services
  try {
    await proofGenerator.initialize();
    await homomorphicEncryption.initialize();
    logger.info('ZK service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize ZK service', error);
    // Continue anyway - some features may not work until circuits are compiled
  }

  // Start server
  app.listen(PORT, () => {
    logger.info(`ZK Service listening on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(error => {
    logger.error('Failed to start ZK service', error);
    process.exit(1);
  });
}
