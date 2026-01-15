import express from 'express';
import { marketService } from '../services/marketService';
import { logger } from '../utils/logger';

export const marketRoutes = express.Router();

// Create a new market
marketRoutes.post('/', async (req, res) => {
  try {
    const market = await marketService.createMarket(req.body);
    res.json(market);
  } catch (error: any) {
    logger.error('Error creating market', error);
    res.status(500).json({ error: error.message || 'Failed to create market' });
  }
});

// Place a bet
marketRoutes.post('/:marketId/bets', async (req, res) => {
  try {
    const { marketId } = req.params;
    const bet = await marketService.placeBet({
      ...req.body,
      marketId
    });
    res.json(bet);
  } catch (error: any) {
    logger.error('Error placing bet', error);
    res.status(500).json({ error: error.message || 'Failed to place bet' });
  }
});

// Get market status
marketRoutes.get('/:marketId/status', async (req, res) => {
  try {
    const { marketId } = req.params;
    const status = await marketService.getMarketStatus(marketId);
    res.json(status);
  } catch (error: any) {
    logger.error('Error getting market status', error);
    res.status(500).json({ error: error.message || 'Failed to get market status' });
  }
});

// Resolve market
marketRoutes.post('/:marketId/resolve', async (req, res) => {
  try {
    const { marketId } = req.params;
    const market = await marketService.resolveMarket({
      marketId,
      ...req.body
    });
    res.json(market);
  } catch (error: any) {
    logger.error('Error resolving market', error);
    res.status(500).json({ error: error.message || 'Failed to resolve market' });
  }
});

// Get active markets for a dApp
marketRoutes.get('/dapp/:dappId', async (req, res) => {
  try {
    const { dappId } = req.params;
    const markets = await marketService.getActiveMarketsForDApp(dappId);
    res.json({ markets });
  } catch (error: any) {
    logger.error('Error getting markets for dApp', error);
    res.status(500).json({ error: error.message || 'Failed to get markets' });
  }
});
