import express from 'express';
import { logger } from './utils/logger';
import { marketRoutes } from './routes/markets';
import { safetyRoutes } from './routes/safety';
import { governanceRouter } from './routes/governance';
import nodeRegistryRouter from './routes/nodeRegistry';
import { schedulerService } from './services/scheduler';

const app = express();
const PORT = process.env.PORT || 3008;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'pm-service',
    timestamp: new Date().toISOString() 
  });
});

// Routes
app.use('/markets', marketRoutes);
app.use('/safety', safetyRoutes);
app.use('/governance', governanceRouter);
app.use('/node-registry', nodeRegistryRouter);

// Export app for testing
export { app };

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Prediction Market Service listening on port ${PORT}`);
    
    // Start scheduler to auto-resolve expired markets
    schedulerService.start();
  });
}
