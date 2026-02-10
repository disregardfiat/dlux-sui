import express from 'express';
import { marketService } from '../services/marketService';
import { safetyService } from '../services/safetyService';
import { logger } from '../utils/logger';

export const safetyRoutes = express.Router();

// Get safety status for a dApp
safetyRoutes.get('/dapp/:dappId', async (req, res) => {
  try {
    const { dappId } = req.params;
    const { permlink, author } = req.query;
    const status = await safetyService.getDAppSafetyStatus(
      dappId,
      permlink as string | undefined,
      author as string | undefined
    );
    res.json(status);
  } catch (error: any) {
    logger.error('Error getting safety status', error);
    res.status(500).json({ error: error.message || 'Failed to get safety status' });
  }
});

// Flag a dApp
safetyRoutes.post('/flag', async (req, res) => {
  try {
    const flag = await safetyService.flagDApp(req.body);
    res.json(flag);
  } catch (error: any) {
    logger.error('Error flagging dApp', error);
    res.status(500).json({ error: error.message || 'Failed to flag dApp' });
  }
});
