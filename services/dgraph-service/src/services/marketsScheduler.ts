/**
 * Markets scheduler: auto-resolve expired prediction markets.
 * Runs periodically (default every 15 min). Finds open markets where expiresAt < now,
 * resolves them capital-weighted (safePool >= unsafePool → safe, else unsafe),
 * updates DGraph, and credits winning bettors via earningsService.
 */

import { logger } from '../utils/logger';
import { dgraphClient } from '../dgraph/client';
import { earningsService } from '../services/earningsService';

const PM_AUTO_RESOLVE_INTERVAL_MS = Number(process.env.PM_AUTO_RESOLVE_INTERVAL_MS) || 15 * 60 * 1000;

function isDGraphAvailable(): boolean {
  try {
    dgraphClient.getClient();
    return true;
  } catch {
    return false;
  }
}

async function resolveMarketInternal(marketId: string, resolution: 'safe' | 'unsafe'): Promise<boolean> {
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
  if (!market || market.status !== 'open') return false;

  const winningSide = resolution;
  const winningPool = winningSide === 'safe' ? (market.safePool || 0) : (market.unsafePool || 0);
  const losingPool = winningSide === 'safe' ? (market.unsafePool || 0) : (market.safePool || 0);
  const bets = market.bets || [];

  const betUpdates: Array<{ id: string; payout: number; bettor: string }> = [];
  const accountEarnings: Record<string, number> = {};

  for (const bet of bets) {
    if (bet.side === winningSide) {
      const payout = winningPool > 0
        ? bet.amount + (bet.amount / winningPool) * losingPool
        : bet.amount;
      betUpdates.push({ id: bet.id, payout, bettor: bet.bettor });
      accountEarnings[bet.bettor] = (accountEarnings[bet.bettor] || 0) + payout;
    } else {
      betUpdates.push({ id: bet.id, payout: 0, bettor: bet.bettor });
    }
  }

  const now = new Date();
  const marketMutation = {
    set: {
      uid: `_:market_${marketId}`,
      id: marketId,
      dgraph_type: 'PredictionMarket',
      status: 'resolved',
      resolution: winningSide,
      resolvedAt: now.toISOString(),
    },
  };
  await dgraphClient.mutate(marketMutation);

  for (const betUpdate of betUpdates) {
    const betMutation = {
      set: {
        uid: `_:bet_${betUpdate.id}`,
        id: betUpdate.id,
        dgraph_type: 'PredictionBet',
        payout: betUpdate.payout,
      },
    };
    await dgraphClient.mutate(betMutation);
  }

  for (const [bettor, totalPayout] of Object.entries(accountEarnings)) {
    if (totalPayout > 0) {
      try {
        await earningsService.addAccountPMEarnings(bettor, totalPayout);
      } catch (earningsErr) {
        logger.warn('Failed to update account PM earnings (non-fatal)', { bettor, error: earningsErr });
      }
    }
  }

  logger.info('Auto-resolved prediction market', {
    marketId,
    resolution: winningSide,
    winningBettors: Object.keys(accountEarnings).length,
    totalPayouts: Object.values(accountEarnings).reduce((a, b) => a + b, 0),
  });
  return true;
}

export async function checkAndResolveExpiredMarkets(): Promise<number> {
  if (!isDGraphAvailable()) return 0;

  const now = new Date().toISOString();
  const query = `
    query expiredMarkets($now: string) {
      markets(func: type(PredictionMarket)) @filter(
        eq(status, "open") AND lt(expiresAt, $now)
      ) {
        id
        safePool
        unsafePool
      }
    }
  `;

  const result = await dgraphClient.query(query, { $now: now });
  const markets = result.markets || [];
  let resolved = 0;

  for (const m of markets) {
    try {
      const resolution: 'safe' | 'unsafe' =
        (m.safePool || 0) >= (m.unsafePool || 0) ? 'safe' : 'unsafe';
      const ok = await resolveMarketInternal(m.id, resolution);
      if (ok) resolved++;
    } catch (err) {
      logger.error('Failed to auto-resolve market', { marketId: m.id, error: err });
    }
  }

  if (resolved > 0) {
    logger.info('Auto-resolved expired markets', { count: resolved, marketIds: markets.slice(0, resolved).map((x: any) => x.id) });
  }
  return resolved;
}

let intervalId: NodeJS.Timeout | null = null;

export function startMarketsScheduler(): void {
  if (intervalId) return;

  const run = async () => {
    try {
      await checkAndResolveExpiredMarkets();
    } catch (err) {
      logger.error('Markets scheduler run failed', { error: err });
    }
  };

  intervalId = setInterval(run, PM_AUTO_RESOLVE_INTERVAL_MS);
  run().catch((err) => logger.error('Initial markets scheduler run failed', { error: err }));
  logger.info('Markets scheduler started', { intervalMs: PM_AUTO_RESOLVE_INTERVAL_MS });
}

export function stopMarketsScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Markets scheduler stopped');
  }
}
