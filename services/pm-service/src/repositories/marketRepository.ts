import { PredictionMarket } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { pmDgraphClient } from './dgraphClient';

export class MarketRepository {
  async save(market: PredictionMarket): Promise<void> {
    const mutation = {
      set: {
        uid: `_:${market.id}`,
        dgraph_type: 'PredictionMarket',
        id: market.id,
        dappId: market.dappId,
        safetyMetric: market.safetyMetric,
        description: market.description,
        status: market.status,
        resolution: market.resolution,
        totalPool: market.totalPool,
        safePool: market.safePool,
        unsafePool: market.unsafePool,
        postingFeeContribution: market.postingFeeContribution,
        recommendedAge: market.recommendedAge,
        metadataKey: market.metadataKey,
        metadataValue: market.metadataValue,
        minPoolForRating: market.minPoolForRating,
        createdAt: market.createdAt.toISOString(),
        expiresAt: market.expiresAt.toISOString(),
        resolvedAt: market.resolvedAt ? market.resolvedAt.toISOString() : null,
        triggeredBy: market.triggeredBy,
        triggeredByAddress: market.triggeredByAddress
      }
    };

    // Handle bets array separately
    if (market.bets && market.bets.length > 0) {
      // This would need more complex handling for nested objects
      // For now, we'll store bets separately and link them
    }

    await pmDgraphClient.mutate(mutation);
    logger.debug('Market saved to Dgraph', { marketId: market.id });
  }

  async findById(id: string): Promise<PredictionMarket | null> {
    const query = `
      query market($id: string) {
        market(func: eq(id, $id)) @filter(type(PredictionMarket)) {
          id
          dappId
          safetyMetric
          description
          status
          resolution
          totalPool
          safePool
          unsafePool
          postingFeeContribution
          recommendedAge
          metadataKey
          metadataValue
          minPoolForRating
          createdAt
          expiresAt
          resolvedAt
          triggeredBy
          triggeredByAddress
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $id: id });
    const market = result.market?.[0];

    if (!market) return null;

    return {
      ...market,
      createdAt: new Date(market.createdAt),
      expiresAt: new Date(market.expiresAt),
      resolvedAt: market.resolvedAt ? new Date(market.resolvedAt) : null,
      bets: [] // TODO: Load bets separately
    };
  }

  async findActiveByDApp(dappId: string): Promise<PredictionMarket[]> {
    const now = new Date().toISOString();

    const query = `
      query activeMarkets($dappId: string, $now: datetime) {
        markets(func: type(PredictionMarket)) @filter(
          eq(dappId, $dappId) AND
          eq(status, "open") AND
          gt(expiresAt, $now)
        ) {
          id
          dappId
          safetyMetric
          description
          status
          resolution
          totalPool
          safePool
          unsafePool
          postingFeeContribution
          recommendedAge
          metadataKey
          metadataValue
          minPoolForRating
          createdAt
          expiresAt
          resolvedAt
          triggeredBy
          triggeredByAddress
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $dappId: dappId, $now: now });

    return (result.markets || []).map((market: any) => ({
      ...market,
      createdAt: new Date(market.createdAt),
      expiresAt: new Date(market.expiresAt),
      resolvedAt: market.resolvedAt ? new Date(market.resolvedAt) : null,
      bets: [] // TODO: Load bets separately
    }));
  }

  async findExpired(): Promise<PredictionMarket[]> {
    const now = new Date().toISOString();

    const query = `
      query expiredMarkets($now: datetime) {
        markets(func: type(PredictionMarket)) @filter(
          eq(status, "open") AND
          le(expiresAt, $now)
        ) {
          id
          dappId
          safetyMetric
          description
          status
          resolution
          totalPool
          safePool
          unsafePool
          postingFeeContribution
          recommendedAge
          metadataKey
          metadataValue
          minPoolForRating
          createdAt
          expiresAt
          resolvedAt
          triggeredBy
          triggeredByAddress
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $now: now });

    return (result.markets || []).map((market: any) => ({
      ...market,
      createdAt: new Date(market.createdAt),
      expiresAt: new Date(market.expiresAt),
      resolvedAt: market.resolvedAt ? new Date(market.resolvedAt) : null,
      bets: [] // TODO: Load bets separately
    }));
  }

  async findAllByDApp(dappId: string): Promise<PredictionMarket[]> {
    const query = `
      query allMarkets($dappId: string) {
        markets(func: type(PredictionMarket)) @filter(eq(dappId, $dappId)) {
          id
          dappId
          safetyMetric
          description
          status
          resolution
          totalPool
          safePool
          unsafePool
          postingFeeContribution
          recommendedAge
          metadataKey
          metadataValue
          minPoolForRating
          createdAt
          expiresAt
          resolvedAt
          triggeredBy
          triggeredByAddress
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $dappId: dappId });

    return (result.markets || []).map((market: any) => ({
      ...market,
      createdAt: new Date(market.createdAt),
      expiresAt: new Date(market.expiresAt),
      resolvedAt: market.resolvedAt ? new Date(market.resolvedAt) : null,
      bets: [] // TODO: Load bets separately
    }));
  }

  async findOpenByPool(limit: number): Promise<PredictionMarket[]> {
    const now = new Date().toISOString();
    const query = `
      query openByPool($now: datetime, $limit: int) {
        markets(func: type(PredictionMarket), orderdesc: totalPool, first: $limit) @filter(
          eq(status, "open") AND
          gt(expiresAt, $now)
        ) {
          id
          dappId
          safetyMetric
          description
          status
          resolution
          totalPool
          safePool
          unsafePool
          postingFeeContribution
          recommendedAge
          metadataKey
          metadataValue
          minPoolForRating
          createdAt
          expiresAt
          resolvedAt
          triggeredBy
          triggeredByAddress
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $now: now, $limit: limit });

    return (result.markets || []).map((market: any) => ({
      ...market,
      createdAt: new Date(market.createdAt),
      expiresAt: new Date(market.expiresAt),
      resolvedAt: market.resolvedAt ? new Date(market.resolvedAt) : null,
      bets: []
    }));
  }
}

export const marketRepository = new MarketRepository();
