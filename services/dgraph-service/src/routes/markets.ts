/**
 * Prediction markets API - served from GQL/DGraph (no separate PM service needed)
 */

import express from 'express';
import { logger } from '../utils/logger';
import { dgraphClient } from '../dgraph/client';
import { earningsService } from '../services/earningsService';

const router = express.Router();

/**
 * PM duration in milliseconds. Configurable via PM_DURATION_MS env var.
 * Defaults:
 *   testnet: set PM_DURATION_MS=600000        (10 minutes)
 *   mainnet: set PM_DURATION_MS=259200000     (3 days)
 * Falls back to 3 days if not set.
 */
const PM_DURATION_MS = Number(process.env.PM_DURATION_MS) || 3 * 24 * 60 * 60 * 1000;

function isDGraphAvailable(): boolean {
  try {
    dgraphClient.getClient();
    return true;
  } catch {
    return false;
  }
}

function mapMarket(m: any) {
  return {
    ...m,
    createdAt: m.createdAt ? new Date(m.createdAt) : null,
    expiresAt: m.expiresAt ? new Date(m.expiresAt) : null,
    resolvedAt: m.resolvedAt ? new Date(m.resolvedAt) : null,
    bets: m.bets || [],
  };
}

// GET /markets/fees/:dappId - total fees for dApp
router.get('/fees/:dappId', async (req, res) => {
  try {
    if (!isDGraphAvailable()) {
      return res.json({ total: 0, markets: 0 });
    }
    const { dappId } = req.params;
    const query = `
      query allMarkets($dappId: string) {
        markets(func: eq(dgraph_type, "PredictionMarket")) @filter(eq(dappId, $dappId)) {
          postingFeeContribution
        }
      }
    `;
    const result = await dgraphClient.query(query, { $dappId: dappId });
    const markets = result.markets || [];
    const total = markets.reduce((sum: number, m: any) => sum + (m.postingFeeContribution || 0), 0);
    res.json({ total, markets: markets.length });
  } catch (error: any) {
    logger.error('Error getting dApp fees', error);
    res.status(500).json({ error: error.message || 'Failed to get dApp fees' });
  }
});

// GET /markets/payouts/:owner - payout balance (mock for MVP)
router.get('/payouts/:owner', async (req, res) => {
  try {
    res.json({ total: 0 });
  } catch (error: any) {
    logger.error('Error getting payouts', error);
    res.status(500).json({ error: error.message || 'Failed to get payouts' });
  }
});

// GET /markets/high-payout - markets by pool size
router.get('/high-payout', async (req, res) => {
  try {
    if (!isDGraphAvailable()) {
      return res.json({ markets: [], limit: 10 });
    }
    const limit = parseInt(req.query.limit as string) || 10;
    const now = new Date().toISOString();
    const query = `
      query openByPool($now: string, $limit: int) {
        markets(func: eq(dgraph_type, "PredictionMarket"), orderdesc: totalPool, first: $limit) @filter(
          eq(status, "open") AND ge(expiresAt, $now)
        ) {
          id dappId safetyMetric description status resolution
          totalPool safePool unsafePool postingFeeContribution recommendedAge
          createdAt expiresAt resolvedAt triggeredBy triggeredByAddress
        }
      }
    `;
    const result = await dgraphClient.query(query, { $now: now, $limit: limit });
    const markets = (result.markets || []).map(mapMarket);
    res.json({ markets, limit });
  } catch (error: any) {
    logger.error('Error getting high-payout markets', error);
    res.status(500).json({ error: error.message || 'Failed to get markets' });
  }
});

// GET /markets/dapp/:dappId - active markets for dApp
router.get('/dapp/:dappId', async (req, res) => {
  try {
    if (!isDGraphAvailable()) {
      return res.json({ markets: [] });
    }
    const { dappId } = req.params;
    const now = new Date().toISOString();
    const query = `
      query activeMarkets($dappId: string, $now: string) {
        markets(func: eq(dgraph_type, "PredictionMarket")) @filter(
          eq(dappId, $dappId) AND eq(status, "open") AND ge(expiresAt, $now)
        ) {
          id dappId safetyMetric description status resolution
          totalPool safePool unsafePool postingFeeContribution recommendedAge
          createdAt expiresAt resolvedAt triggeredBy triggeredByAddress txDigest
        }
      }
    `;
    const result = await dgraphClient.query(query, { $dappId: dappId, $now: now });
    const markets = (result.markets || []).map(mapMarket);
    res.json({ markets });
  } catch (error: any) {
    logger.error('Error getting markets for dApp', error);
    res.status(500).json({ error: error.message || 'Failed to get markets' });
  }
});

// POST /markets - create prediction market for a dApp
router.post('/', async (req, res) => {
  try {
    const {
      dappId,
      safetyMetric,
      description,
      postingFeeContribution,
      triggeredBy,
      triggeredByAddress,
      txDigest
    } = req.body || {};

    if (!dappId) {
      return res.status(400).json({ error: 'dappId is required' });
    }

    const marketId = `pm_${dappId}_${safetyMetric || 'safe-and-accurate'}_${Date.now()}`;

    // Check for duplicate: same dappId + safetyMetric that is still open
    if (isDGraphAvailable()) {
      try {
        const dupQuery = `
          query dupCheck($dappId: string, $metric: string) {
            markets(func: eq(dgraph_type, "PredictionMarket")) @filter(
              eq(dappId, $dappId) AND eq(safetyMetric, $metric) AND eq(status, "open")
            ) {
              id
            }
          }
        `;
        const dupResult = await dgraphClient.query(dupQuery, {
          $dappId: dappId,
          $metric: safetyMetric || 'safe-and-accurate'
        });
        if (dupResult.markets && dupResult.markets.length > 0) {
          logger.info('Duplicate PM skipped', { dappId, existing: dupResult.markets[0].id });
          return res.json({ transactionId: dupResult.markets[0].id, duplicate: true });
        }
      } catch (dupErr) {
        logger.warn('Duplicate check failed, proceeding with creation', { dappId, error: dupErr });
      }
    }

    if (!isDGraphAvailable()) {
      // Fallback: return a mock transaction ID when DGraph is down
      const transactionId = `market_tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      return res.json({ transactionId, stored: false });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PM_DURATION_MS);

    const mutation = {
      set: {
        uid: `_:market_${marketId}`,
        dgraph_type: 'PredictionMarket',
        id: marketId,
        dappId,
        safetyMetric: safetyMetric || 'safe-and-accurate',
        description: description || `Safety review for dApp ${dappId}`,
        status: 'open',
        resolution: '',
        totalPool: postingFeeContribution || 0,
        safePool: 0,
        unsafePool: 0,
        postingFeeContribution: postingFeeContribution || 0,
        recommendedAge: 0,
        triggeredBy: triggeredBy || 'posting',
        triggeredByAddress: triggeredByAddress || '',
        txDigest: txDigest || '',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      }
    };

    await dgraphClient.mutate(mutation);
    
    // Persist PM uptake to dApp earnings ledger (cumulative PM uptake)
    if (postingFeeContribution && postingFeeContribution > 0) {
      try {
        await earningsService.addDAppPMEarnings(dappId, postingFeeContribution);
        logger.debug('Updated dApp PM earnings', { dappId, amount: postingFeeContribution });
      } catch (earningsErr) {
        logger.warn('Failed to update dApp PM earnings (non-fatal)', { dappId, error: earningsErr });
      }
    }
    
    logger.info('Created prediction market', { marketId, dappId, contribution: postingFeeContribution });
    res.json({ transactionId: marketId, stored: true });
  } catch (error: any) {
    logger.error('Error creating market', error);
    res.status(500).json({ error: error.message || 'Failed to create market' });
  }
});

// POST /markets/:marketId/bets - place bet (mock - returns tx id; real bet via blockchain)
router.post('/:marketId/bets', async (req, res) => {
  try {
    const transactionId = `bet_tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    res.json({ transactionId });
  } catch (error: any) {
    logger.error('Error placing bet', error);
    res.status(500).json({ error: error.message || 'Failed to place bet' });
  }
});

// GET /markets/:marketId/status - market status (for compatibility)
router.get('/:marketId/status', async (req, res) => {
  try {
    if (!isDGraphAvailable()) {
      return res.status(404).json({ error: 'Market not found' });
    }
    const { marketId } = req.params;
    const query = `
      query market($id: string) {
        market(func: eq(id, $id)) @filter(eq(dgraph_type, "PredictionMarket")) {
          id dappId status resolution totalPool safePool unsafePool
          createdAt expiresAt resolvedAt
        }
      }
    `;
    const result = await dgraphClient.query(query, { $id: marketId });
    const market = result.market?.[0];
    if (!market) return res.status(404).json({ error: 'Market not found' });
    const m = mapMarket(market);
    const daysRemaining = Math.max(0, Math.ceil((m.expiresAt.getTime() - Date.now()) / 86400000));
    const total = m.safePool + m.unsafePool;
    const safeOdds = total > 0 ? m.safePool / total : 0.5;
    res.json({
      market: m,
      daysRemaining,
      confidence: Math.abs(safeOdds - (1 - safeOdds)),
      totalBets: 0,
    });
  } catch (error: any) {
    logger.error('Error getting market status', error);
    res.status(500).json({ error: error.message || 'Failed to get market status' });
  }
});

// POST /markets/:marketId/resolve - resolve market and calculate payouts
router.post('/:marketId/resolve', async (req, res) => {
  try {
    const { marketId } = req.params;
    const { resolution } = req.body; // 'safe' or 'unsafe'

    if (!resolution || (resolution !== 'safe' && resolution !== 'unsafe')) {
      return res.status(400).json({ error: 'Resolution must be "safe" or "unsafe"' });
    }

    if (!isDGraphAvailable()) {
      return res.status(503).json({ error: 'DGraph unavailable' });
    }

    // Get market with bets
    const query = `
      query marketWithBets($id: string) {
        market(func: eq(id, $id)) @filter(eq(dgraph_type, "PredictionMarket")) {
          id dappId status resolution totalPool safePool unsafePool
          createdAt expiresAt resolvedAt
          bets: bets @filter(eq(dgraph_type, "PredictionBet")) {
            id bettor side amount shares payout
          }
        }
      }
    `;
    const result = await dgraphClient.query(query, { $id: marketId });
    const market = result.market?.[0];
    
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    if (market.status !== 'open') {
      return res.status(400).json({ error: `Market already ${market.status}` });
    }

    const winningSide = resolution;
    const winningPool = winningSide === 'safe' ? (market.safePool || 0) : (market.unsafePool || 0);
    const losingPool = winningSide === 'safe' ? (market.unsafePool || 0) : (market.safePool || 0);
    const bets = market.bets || [];

    // Calculate payouts for each bet
    const betUpdates: Array<{ id: string; payout: number; bettor: string }> = [];
    const accountEarnings: Record<string, number> = {}; // bettor -> total payout

    for (const bet of bets) {
      if (bet.side === winningSide) {
        // Winner gets stake back + proportional share of losing pool
        const payout = bet.amount + (bet.amount / winningPool) * losingPool;
        betUpdates.push({ id: bet.id, payout, bettor: bet.bettor });
        accountEarnings[bet.bettor] = (accountEarnings[bet.bettor] || 0) + payout;
      } else {
        // Loser gets nothing
        betUpdates.push({ id: bet.id, payout: 0, bettor: bet.bettor });
      }
    }

    // Update market status
    const now = new Date();
    const marketMutation = {
      set: {
        uid: `_:market_${marketId}`,
        id: marketId,
        dgraph_type: 'PredictionMarket',
        status: 'resolved',
        resolution: winningSide,
        resolvedAt: now.toISOString()
      }
    };
    await dgraphClient.mutate(marketMutation);

    // Update bet payouts
    for (const betUpdate of betUpdates) {
      const betMutation = {
        set: {
          uid: `_:bet_${betUpdate.id}`,
          id: betUpdate.id,
          dgraph_type: 'PredictionBet',
          payout: betUpdate.payout
        }
      };
      await dgraphClient.mutate(betMutation);
    }

    // Update account earnings for winning bettors (cumulative PM winnings)
    for (const [bettor, totalPayout] of Object.entries(accountEarnings)) {
      if (totalPayout > 0) {
        try {
          await earningsService.addAccountPMEarnings(bettor, totalPayout);
          logger.debug('Updated account PM earnings', { bettor, amount: totalPayout });
        } catch (earningsErr) {
          logger.warn('Failed to update account PM earnings (non-fatal)', { bettor, error: earningsErr });
        }
      }
    }

    logger.info('Resolved prediction market', { 
      marketId, 
      resolution: winningSide, 
      winningBettors: Object.keys(accountEarnings).length,
      totalPayouts: Object.values(accountEarnings).reduce((a, b) => a + b, 0)
    });

    res.json({ 
      marketId, 
      resolution: winningSide, 
      winningBettors: Object.keys(accountEarnings).length,
      totalPayouts: Object.values(accountEarnings).reduce((a, b) => a + b, 0)
    });
  } catch (error: any) {
    logger.error('Error resolving market', error);
    res.status(500).json({ error: error.message || 'Failed to resolve market' });
  }
});

export { router as marketsRouter };
