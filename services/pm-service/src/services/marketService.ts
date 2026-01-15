import {
  PredictionMarket,
  PredictionBet,
  MarketStatus,
  CreateMarketRequest,
  PlaceBetRequest,
  ResolveMarketRequest,
  SafetyMetric,
  AgeRating
} from '@dlux-sui/types';
import { marketRepository } from '../repositories/marketRepository';
import { logger } from '../utils/logger';

export class MarketService {
  /**
   * Create a new prediction market for a dApp safety metric
   */
  async createMarket(request: CreateMarketRequest): Promise<PredictionMarket> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3); // 3 days from now

    // Determine recommended age based on safety metric
    let recommendedAge: AgeRating | undefined;
    if (request.safetyMetric === 'nsfw') {
      recommendedAge = '18+';
    } else if (request.safetyMetric === 'age-restricted') {
      // Extract age from description if provided, default to 18+
      const ageMatch = request.description?.match(/(\d{1,2})\+/i);
      recommendedAge = (ageMatch ? `${ageMatch[1]}+` : '18+') as AgeRating;
    }

    const market: PredictionMarket = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dappId: request.dappId,
      safetyMetric: request.safetyMetric,
      description: request.description || `Safety check for ${request.safetyMetric}`,
      status: 'open',
      resolution: null,
      totalPool: request.postingFeeContribution || 0,
      safePool: 0,
      unsafePool: request.postingFeeContribution || 0, // Initial contribution goes to "unsafe" side
      postingFeeContribution: request.postingFeeContribution || 0,
      recommendedAge,
      createdAt: new Date(),
      expiresAt,
      resolvedAt: null,
      bets: [],
      triggeredBy: request.triggeredBy,
      triggeredByAddress: request.triggeredByAddress
    };

    await marketRepository.save(market);
    logger.info('Market created', { marketId: market.id, dappId: request.dappId });
    
    return market;
  }

  /**
   * Place a bet on a market
   */
  async placeBet(request: PlaceBetRequest): Promise<PredictionBet> {
    const market = await marketRepository.findById(request.marketId);
    
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.status !== 'open') {
      throw new Error('Market is not open for betting');
    }

    if (new Date() >= market.expiresAt) {
      throw new Error('Market has expired');
    }

    // Calculate shares using constant product market maker (CPMM)
    const shares = this.calculateShares(
      request.side === 'safe' ? market.safePool : market.unsafePool,
      request.amount
    );

    const bet: PredictionBet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      marketId: request.marketId,
      bettor: request.bettor,
      side: request.side,
      amount: request.amount,
      shares,
      createdAt: new Date(),
      payout: null
    };

    // Update market pools
    if (request.side === 'safe') {
      market.safePool += request.amount;
    } else {
      market.unsafePool += request.amount;
    }
    market.totalPool = market.safePool + market.unsafePool;
    market.bets.push(bet);

    await marketRepository.save(market);
    logger.info('Bet placed', { betId: bet.id, marketId: request.marketId });

    return bet;
  }

  /**
   * Calculate shares using CPMM formula
   */
  private calculateShares(pool: number, amount: number): number {
    if (pool === 0) {
      return amount; // First bet gets 1:1 shares
    }
    // Simplified CPMM: shares = amount * (totalPool / pool)
    // This ensures the market maker maintains liquidity
    return amount * (1 + (amount / pool));
  }

  /**
   * Resolve a market based on final market odds
   */
  async resolveMarket(request: ResolveMarketRequest): Promise<PredictionMarket> {
    const market = await marketRepository.findById(request.marketId);
    
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.status !== 'open') {
      throw new Error('Market is not open');
    }

    // Market resolves based on which side has more total value
    // If safePool > unsafePool, resolution is "safe", otherwise "unsafe"
    const resolution = market.safePool > market.unsafePool ? 'safe' : 'unsafe';
    
    // If resolution matches request, use it; otherwise use market-determined resolution
    const finalResolution = request.resolution || resolution;

    market.status = 'resolved';
    market.resolution = finalResolution;
    market.resolvedAt = new Date();

    // Calculate payouts
    const winningSide = finalResolution === 'safe' ? 'safe' : 'unsafe';
    const winningPool = finalResolution === 'safe' ? market.safePool : market.unsafePool;
    const losingPool = finalResolution === 'safe' ? market.unsafePool : market.safePool;

    // Distribute winnings proportionally
    for (const bet of market.bets) {
      if (bet.side === winningSide) {
        // Payout = bet amount + (bet amount / winning pool) * losing pool
        bet.payout = bet.amount + (bet.amount / winningPool) * losingPool;
      } else {
        bet.payout = 0; // Losing bets get nothing
      }
    }

    await marketRepository.save(market);
    logger.info('Market resolved', { 
      marketId: request.marketId, 
      resolution: finalResolution,
      totalPayout: market.bets.reduce((sum, bet) => sum + (bet.payout || 0), 0)
    });

    return market;
  }

  /**
   * Get market status with color coding
   */
  async getMarketStatus(marketId: string): Promise<MarketStatus> {
    const market = await marketRepository.findById(marketId);
    
    if (!market) {
      throw new Error('Market not found');
    }

    const daysRemaining = Math.max(0, Math.ceil(
      (market.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));

    // Calculate confidence based on market odds
    const total = market.safePool + market.unsafePool;
    const safeOdds = total > 0 ? market.safePool / total : 0.5;
    const unsafeOdds = total > 0 ? market.unsafePool / total : 0.5;

    // Confidence is the difference between the two sides
    const confidence = Math.abs(safeOdds - unsafeOdds);

    // Determine status color
    let statusColor: 'green' | 'yellow' | 'red';
    if (market.status === 'resolved') {
      statusColor = market.resolution === 'safe' ? 'green' : 'red';
    } else {
      // Green if safe side is winning, red if unsafe is winning, yellow if close
      if (safeOdds > 0.6) {
        statusColor = 'green';
      } else if (unsafeOdds > 0.6) {
        statusColor = 'red';
      } else {
        statusColor = 'yellow';
      }
    }

    return {
      market,
      statusColor,
      confidence,
      daysRemaining,
      totalBets: market.bets.length,
      activeBettors: new Set(market.bets.map(b => b.bettor)).size
    };
  }

  /**
   * Get all active markets for a dApp
   */
  async getActiveMarketsForDApp(dappId: string): Promise<PredictionMarket[]> {
    return await marketRepository.findActiveByDApp(dappId);
  }

  /**
   * Check and auto-resolve expired markets
   */
  async checkExpiredMarkets(): Promise<void> {
    const expiredMarkets = await marketRepository.findExpired();
    
    for (const market of expiredMarkets) {
      if (market.status === 'open') {
        // Resolve based on market odds
        const resolution = market.safePool > market.unsafePool ? 'safe' : 'unsafe';
        await this.resolveMarket({
          marketId: market.id,
          resolution
        });
        logger.info('Auto-resolved expired market', { marketId: market.id });
      }
    }
  }
}

export const marketService = new MarketService();
