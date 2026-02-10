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
   * Create a new prediction market for a dApp safety metric via SUI blockchain
   */
  async createMarket(request: CreateMarketRequest): Promise<{ transactionId: string }> {
    // TODO: Create and submit SUI transaction for prediction market creation

    // Mock SUI transaction - replace with actual blockchain interaction
    const transactionId = `market_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Prediction market creation transaction submitted', {
      dappId: request.dappId,
      safetyMetric: request.safetyMetric,
      transactionId
    });

    // Note: Actual persistence will happen via blockchain indexer
    // when the transaction is confirmed

    return { transactionId };
  }

  /**
   * Place a bet on a market via SUI blockchain
   */
  async placeBet(request: PlaceBetRequest): Promise<{ transactionId: string }> {
    // TODO: Create and submit SUI transaction for bet placement

    // Mock SUI transaction - replace with actual blockchain interaction
    const transactionId = `bet_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Bet placement transaction submitted', {
      marketId: request.marketId,
      bettor: request.bettor,
      side: request.side,
      amount: request.amount,
      transactionId
    });

    // Note: Actual persistence will happen via blockchain indexer
    // when the transaction is confirmed

    return { transactionId };
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
   * Resolve a market based on final market odds via SUI blockchain
   */
  async resolveMarket(request: ResolveMarketRequest): Promise<{ transactionId: string }> {
    // TODO: Create and submit SUI transaction for market resolution

    // Mock SUI transaction - replace with actual blockchain interaction
    const transactionId = `resolve_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Market resolution transaction submitted', {
      marketId: request.marketId,
      transactionId
    });

    // Note: Actual persistence will happen via blockchain indexer
    // when the transaction is confirmed

    return { transactionId };
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
      activeBettors: new Set(market.bets.map(b => b.bettor)).size,
      isOfficial: market.totalPool >= this.getMinPoolForRating(market),
      minPoolForRating: this.getMinPoolForRating(market)
    };
  }

  /**
   * Get all active markets for a dApp
   */
  async getActiveMarketsForDApp(dappId: string): Promise<PredictionMarket[]> {
    return await marketRepository.findActiveByDApp(dappId);
  }

  async getHighPayoutMarkets(limit = 10): Promise<PredictionMarket[]> {
    return await marketRepository.findOpenByPool(limit);
  }

  private getMinPoolForRating(market: PredictionMarket): number {
    if (typeof market.minPoolForRating === 'number') {
      return market.minPoolForRating;
    }
    const defaultThreshold = process.env.PM_MIN_POOL_FOR_RATING;
    if (defaultThreshold && !Number.isNaN(Number(defaultThreshold))) {
      return Number(defaultThreshold);
    }
    return 10;
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
