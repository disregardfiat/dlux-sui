/**
 * Safety API - dApp safety status (PM data from DGraph)
 */

import express from 'express';
import { logger } from '../utils/logger';
import { dgraphClient } from '../dgraph/client';

const router = express.Router();

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

router.get('/dapp/:dappId', async (req, res) => {
  try {
    const { dappId } = req.params;
    if (!isDGraphAvailable()) {
      return res.json({
        dappId,
        permlink: req.query.permlink || '',
        author: req.query.author || '',
        activeMarkets: [],
        overallStatus: 'unknown',
        overallColor: 'gray',
        resolvedMarkets: [],
        flags: [],
        lastChecked: new Date().toISOString(),
      });
    }
    const now = new Date().toISOString();
    const query = `
      query safety($dappId: string, $now: string) {
        active(func: type(PredictionMarket)) @filter(eq(dappId, $dappId) AND eq(status, "open") AND gt(expiresAt, $now)) {
          id dappId status resolution totalPool safePool unsafePool expiresAt
        }
        resolved(func: type(PredictionMarket)) @filter(eq(dappId, $dappId) AND eq(status, "resolved")) {
          id resolution totalPool safePool unsafePool postingFeeContribution safetyMetric triggeredByAddress
        }
      }
    `;
    const result = await dgraphClient.query(query, { $dappId: dappId, $now: now });
    const activeMarkets = (result.active || []).map(mapMarket);
    const resolvedMarkets = (result.resolved || []).map(mapMarket);
    let overallStatus: 'safe' | 'warning' | 'unsafe' | 'unknown' = 'unknown';
    let overallColor: 'green' | 'yellow' | 'red' | 'gray' = 'gray';

    // safeOdds = probability market assigns to "safe" (0–1). Below 0.5 = negative accuracy (leans unsafe).
    let safeOdds: number | null = null;
    let totalPool = 0;
    const allMarkets = [...activeMarkets, ...resolvedMarkets];
    for (const m of allMarkets) {
      const safe = Number(m.safePool) || 0;
      const unsafe = Number(m.unsafePool) || 0;
      const t = safe + unsafe;
      if (t > totalPool) {
        totalPool = t;
        safeOdds = t > 0 ? safe / t : 0.5;
      }
    }
    if (safeOdds === null && resolvedMarkets.length > 0) {
      const m = resolvedMarkets[0];
      const safe = Number(m.safePool) || 0;
      const unsafe = Number(m.unsafePool) || 0;
      const t = safe + unsafe;
      safeOdds = t > 0 ? safe / t : 0.5;
      totalPool = t;
    }

    if (resolvedMarkets.some((m: any) => m.resolution === 'unsafe')) {
      overallStatus = 'unsafe';
      overallColor = 'red';
    } else if (activeMarkets.length > 0 || resolvedMarkets.length > 0) {
      overallStatus = 'safe';
      overallColor = 'green';
    }

    // "Negative accuracy": market currently leans unsafe (safeOdds < 0.5) even if not yet resolved.
    const negativeAccuracy = safeOdds !== null && safeOdds < 0.5;
    const confidence = safeOdds !== null ? Math.abs(safeOdds - (1 - safeOdds)) : 0;
    // Less tested: no resolved outcome yet, or very low total pool.
    const lessTested = resolvedMarkets.length === 0 && (totalPool < 1 || activeMarkets.length === 0);

    if (negativeAccuracy && overallStatus !== 'unsafe') overallColor = 'yellow';
    if (lessTested && overallColor === 'gray') overallColor = 'yellow';

    res.json({
      dappId,
      permlink: req.query.permlink || '',
      author: req.query.author || '',
      activeMarkets,
      overallStatus,
      overallColor,
      resolvedMarkets,
      flags: [],
      lastChecked: new Date().toISOString(),
      safeOdds: safeOdds ?? undefined,
      confidence,
      negativeAccuracy,
      lessTested,
      totalPool,
    });
  } catch (error: any) {
    logger.error('Error getting safety status', error);
    res.status(500).json({ error: error.message || 'Failed to get safety status' });
  }
});

router.post('/flag', async (req, res) => {
  try {
    res.status(201).json({
      id: `flag_${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Error flagging dApp', error);
    res.status(500).json({ error: error.message || 'Failed to flag dApp' });
  }
});

export { router as safetyRouter };
