import { PredictionMarket } from '@dlux-sui/types';
import { logger } from '../utils/logger';

// In-memory storage for now - should be replaced with database
const markets = new Map<string, PredictionMarket>();

export class MarketRepository {
  async save(market: PredictionMarket): Promise<void> {
    markets.set(market.id, market);
    logger.debug('Market saved', { marketId: market.id });
  }

  async findById(id: string): Promise<PredictionMarket | null> {
    return markets.get(id) || null;
  }

  async findActiveByDApp(dappId: string): Promise<PredictionMarket[]> {
    const now = new Date();
    return Array.from(markets.values()).filter(
      m => m.dappId === dappId && 
           m.status === 'open' && 
           m.expiresAt > now
    );
  }

  async findExpired(): Promise<PredictionMarket[]> {
    const now = new Date();
    return Array.from(markets.values()).filter(
      m => m.status === 'open' && m.expiresAt <= now
    );
  }

  async findAllByDApp(dappId: string): Promise<PredictionMarket[]> {
    return Array.from(markets.values()).filter(m => m.dappId === dappId);
  }
}

export const marketRepository = new MarketRepository();
