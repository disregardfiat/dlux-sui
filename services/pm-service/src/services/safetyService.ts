import {
  DAppSafetyStatus,
  SafetyFlag,
  CreateMarketRequest,
  SafetyMetric
} from '@dlux-sui/types';
import { marketService } from './marketService';
import { flagRepository } from '../repositories/flagRepository';
import { logger } from '../utils/logger';

export class SafetyService {
  /**
   * Get overall safety status for a dApp
   */
  async getDAppSafetyStatus(dappId: string, permlink?: string, author?: string): Promise<DAppSafetyStatus> {
    const activeMarkets = await marketService.getActiveMarketsForDApp(dappId);
    const flags = await flagRepository.findByDApp(dappId);
    
    // Get all markets (including resolved)
    const allMarkets = await marketService.getActiveMarketsForDApp(dappId);
    const resolvedMarkets = allMarkets.filter(m => m.status === 'resolved');

    // Determine overall status
    let overallStatus: 'safe' | 'warning' | 'unsafe' | 'unknown' = 'unknown';
    let overallColor: 'green' | 'yellow' | 'red' | 'gray' = 'gray';

    if (activeMarkets.length === 0 && resolvedMarkets.length === 0) {
      overallStatus = 'unknown';
      overallColor = 'gray';
    } else if (activeMarkets.length > 0) {
      // Check active markets for status
      const marketStatuses = await Promise.all(
        activeMarkets.map(m => marketService.getMarketStatus(m.id))
      );

      // If any market is red, overall is unsafe
      if (marketStatuses.some(s => s.statusColor === 'red')) {
        overallStatus = 'unsafe';
        overallColor = 'red';
      } else if (marketStatuses.some(s => s.statusColor === 'yellow')) {
        overallStatus = 'warning';
        overallColor = 'yellow';
      } else {
        overallStatus = 'safe';
        overallColor = 'green';
      }
    } else {
      // Only resolved markets - check if any were resolved as unsafe
      if (resolvedMarkets.some(m => m.resolution === 'unsafe')) {
        overallStatus = 'unsafe';
        overallColor = 'red';
      } else {
        overallStatus = 'safe';
        overallColor = 'green';
      }
    }

    return {
      dappId,
      permlink: permlink || '',
      author: author || '',
      activeMarkets,
      overallStatus,
      overallColor,
      resolvedMarkets,
      flags,
      lastChecked: new Date()
    };
  }

  /**
   * Flag a dApp for a safety issue
   */
  async flagDApp(data: {
    dappId: string;
    metric: SafetyMetric;
    description: string;
    flaggedBy: string;
  }): Promise<SafetyFlag> {
    const flag: SafetyFlag = {
      id: `flag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dappId: data.dappId,
      metric: data.metric,
      description: data.description,
      flaggedBy: data.flaggedBy,
      createdAt: new Date()
    };

    await flagRepository.save(flag);

    // Create a new prediction market for this flag
    const marketRequest: CreateMarketRequest = {
      dappId: data.dappId,
      safetyMetric: data.metric,
      description: data.description,
      triggeredBy: 'flag',
      triggeredByAddress: data.flaggedBy
    };

    await marketService.createMarket(marketRequest);
    logger.info('dApp flagged and market created', { 
      flagId: flag.id, 
      dappId: data.dappId 
    });

    return flag;
  }
}

export const safetyService = new SafetyService();
