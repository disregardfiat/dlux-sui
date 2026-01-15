import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { webhookRouter } from './routes/webhook';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow webhooks from GitHub
}));
app.use(cors());
// Don't use express.json() here - we need raw body for signature verification
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', webhookRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'webhook-service',
    timestamp: new Date().toISOString(),
    configured: !!process.env.GITHUB_WEBHOOK_SECRET,
  });
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
  app.listen(PORT, () => {
    logger.info(`Webhook Service listening on port ${PORT}`);
    
    if (!process.env.GITHUB_WEBHOOK_SECRET) {
      logger.warn('GITHUB_WEBHOOK_SECRET not configured - webhooks will not be verified');
    }
    
    logger.info('Ready to receive GitHub webhooks');
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
