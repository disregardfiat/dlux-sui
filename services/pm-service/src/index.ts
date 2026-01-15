import express from 'express';
import { logger } from './utils/logger';
import { marketRoutes } from './routes/markets';
import { safetyRoutes } from './routes/safety';
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

app.listen(PORT, () => {
  logger.info(`Prediction Market Service listening on port ${PORT}`);
  
  // Start scheduler to auto-resolve expired markets
  schedulerService.start();
});
