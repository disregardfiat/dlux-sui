import express from 'express';
import { logger } from '../utils/logger';
import { governanceService } from '../services/governanceService';
import type {
  CreateGovernanceMarketRequest,
  PlaceGovernanceBetRequest,
  ResolveGovernanceMarketRequest
} from '@dlux-sui/types';

const router = express.Router();

// Create a governance market for a variable change
router.post('/markets', async (req, res) => {
  try {
    const request: CreateGovernanceMarketRequest = req.body;

    if (!request.variable || !request.proposedValue || !request.triggeredBy || !request.triggeredByAddress) {
      return res.status(400).json({
        error: 'Variable, proposedValue, triggeredBy, and triggeredByAddress are required'
      });
    }

    const market = await governanceService.createGovernanceMarket(request);
    res.status(201).json(market);

  } catch (error: any) {
    logger.error('Error creating governance market', error);
    res.status(500).json({ error: error.message || 'Failed to create governance market' });
  }
});

// Get active governance markets (at /governance/markets as documented)
// Must be defined BEFORE /markets/:marketId to avoid Express matching "active" as a marketId
router.get('/markets', async (req, res) => {
  try {
    const markets = await governanceService.getActiveGovernanceMarkets();
    res.json({ markets });

  } catch (error: any) {
    logger.error('Error getting active governance markets', error);
    res.status(500).json({ error: error.message || 'Failed to get active governance markets' });
  }
});

// Get active governance markets (legacy /active path for backward compatibility)
router.get('/markets/active', async (req, res) => {
  try {
    const markets = await governanceService.getActiveGovernanceMarkets();
    res.json({ markets });

  } catch (error: any) {
    logger.error('Error getting active governance markets', error);
    res.status(500).json({ error: error.message || 'Failed to get active governance markets' });
  }
});

// Get governance market by ID
router.get('/markets/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    const market = await governanceService.getGovernanceMarket(marketId);

    if (!market) {
      return res.status(404).json({ error: 'Governance market not found' });
    }

    res.json(market);

  } catch (error: any) {
    logger.error('Error getting governance market', error);
    res.status(500).json({ error: error.message || 'Failed to get governance market' });
  }
});

// Place a bet on a governance market
router.post('/markets/:marketId/bet', async (req, res) => {
  try {
    const { marketId } = req.params;
    const request: PlaceGovernanceBetRequest = { ...req.body, marketId };

    if (!request.bettor || !request.side || request.amount === undefined) {
      return res.status(400).json({
        error: 'Bettor, side, and amount are required'
      });
    }

    if (!['yes', 'no'].includes(request.side)) {
      return res.status(400).json({
        error: 'Side must be "yes" or "no"'
      });
    }

    const bet = await governanceService.placeGovernanceBet(request);
    res.status(201).json(bet);

  } catch (error: any) {
    logger.error('Error placing governance bet', error);
    res.status(500).json({ error: error.message || 'Failed to place governance bet' });
  }
});

// Get governance variables
router.get('/variables', async (req, res) => {
  try {
    const variables = await governanceService.getGovernanceVariables();
    res.json({ variables });

  } catch (error: any) {
    logger.error('Error getting governance variables', error);
    res.status(500).json({ error: error.message || 'Failed to get governance variables' });
  }
});

// Get specific governance variable
router.get('/variables/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const variable = await governanceService.getGovernanceVariable(name);

    if (!variable) {
      return res.status(404).json({ error: 'Governance variable not found' });
    }

    res.json(variable);

  } catch (error: any) {
    logger.error('Error getting governance variable', error);
    res.status(500).json({ error: error.message || 'Failed to get governance variable' });
  }
});

// Manually resolve a governance market (admin only - should be automated)
router.post('/markets/:marketId/resolve', async (req, res) => {
  try {
    const { marketId } = req.params;
    const request: ResolveGovernanceMarketRequest = { ...req.body, marketId };

    const market = await governanceService.resolveGovernanceMarket(request);
    res.json(market);

  } catch (error: any) {
    logger.error('Error resolving governance market', error);
    res.status(500).json({ error: error.message || 'Failed to resolve governance market' });
  }
});

export { router as governanceRouter };