import express from 'express';
import { marketService } from '../services/marketService';
import { marketRepository } from '../repositories/marketRepository';
import { logger } from '../utils/logger';

export const marketRoutes = express.Router();

// Get total fees collected for a dApp (for storage funding)
marketRoutes.get('/fees/:dappId', async (req, res) => {
  try {
    const { dappId } = req.params;

    // Get all markets for this dApp
    const markets = await marketRepository.findAllByDApp(dappId);

    // Sum posting fee contributions
    const totalFees = markets.reduce((sum, market) => {
      return sum + (market.postingFeeContribution || 0);
    }, 0);

    res.json({ total: totalFees, markets: markets.length });
  } catch (error: any) {
    logger.error('Error getting dApp fees', error);
    res.status(500).json({ error: error.message || 'Failed to get dApp fees' });
  }
});

// Get payout balance for an owner (from resolved markets where they were bettors)
marketRoutes.get('/payouts/:owner', async (req, res) => {
  try {
    const { owner } = req.params;

    // In production, this would query for bets placed by the owner and calculate payouts
    // For MVP, return mock data
    const totalPayouts = 1.25; // Mock amount

    res.json({ total: totalPayouts });
  } catch (error: any) {
    logger.error('Error getting owner payouts', error);
    res.status(500).json({ error: error.message || 'Failed to get owner payouts' });
  }
});

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

// Get markets with highest payout potential (by pool size)
marketRoutes.get('/high-payout', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const markets = await marketService.getHighPayoutMarkets(limit);
    res.json({ markets, limit });
  } catch (error: any) {
    logger.error('Error getting high payout markets', error);
    res.status(500).json({ error: error.message || 'Failed to get high payout markets' });
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
