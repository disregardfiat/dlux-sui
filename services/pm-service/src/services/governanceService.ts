import {
  GovernanceVariable,
  GovernanceMarket,
  GovernanceBet,
  CreateGovernanceMarketRequest,
  PlaceGovernanceBetRequest,
  ResolveGovernanceMarketRequest
} from '@dlux-sui/types';
import { governanceRepository } from '../repositories/governanceRepository';
import { logger } from '../utils/logger';

export class GovernanceService {
  /**
   * Get all governance variables
   */
  async getGovernanceVariables(): Promise<GovernanceVariable[]> {
    return await governanceRepository.getAllVariables();
  }

  /**
   * Get a specific governance variable
   */
  async getGovernanceVariable(name: string): Promise<GovernanceVariable | null> {
    return await governanceRepository.getVariable(name);
  }

  /**
   * Create a governance market for changing a variable via SUI blockchain
   */
  async createGovernanceMarket(request: CreateGovernanceMarketRequest): Promise<{ transactionId: string }> {
    // TODO: Create and submit SUI transaction for governance market creation

    // Mock SUI transaction - replace with actual blockchain interaction
    const transactionId = `gov_market_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Governance market creation transaction submitted', {
      variable: request.variable,
      proposedValue: request.proposedValue,
      transactionId
    });

    // Note: Actual persistence will happen via blockchain indexer
    // when the transaction is confirmed

    return { transactionId };
  }

  /**
   * Get a governance market by ID
   */
  async getGovernanceMarket(marketId: string): Promise<GovernanceMarket | null> {
    return await governanceRepository.getMarket(marketId);
  }

  /**
   * Place a bet on a governance market via SUI blockchain
   */
  async placeGovernanceBet(request: PlaceGovernanceBetRequest): Promise<{ transactionId: string }> {
    // TODO: Create and submit SUI transaction for governance bet placement

    // Mock SUI transaction - replace with actual blockchain interaction
    const transactionId = `gov_bet_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Governance bet placement transaction submitted', {
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
   * Get active governance markets
   */
  async getActiveGovernanceMarkets(): Promise<GovernanceMarket[]> {
    return await governanceRepository.getActiveMarkets();
  }

  /**
   * Resolve a governance market via SUI blockchain
   */
  async resolveGovernanceMarket(request: ResolveGovernanceMarketRequest): Promise<{ transactionId: string }> {
    // TODO: Create and submit SUI transaction for governance market resolution

    // Mock SUI transaction - replace with actual blockchain interaction
    const transactionId = `gov_resolve_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Governance market resolution transaction submitted', {
      marketId: request.marketId,
      transactionId
    });

    // Note: Actual persistence will happen via blockchain indexer
    // when the transaction is confirmed

    return { transactionId };
  }

  /**
   * Check if a variable change is within the annual cap
   */
  private checkAnnualCap(variable: GovernanceVariable, proposedValue: string): boolean {
    const currentValue = parseFloat(variable.value);
    const newValue = parseFloat(proposedValue);
    const changePct = Math.abs((newValue - currentValue) / currentValue);

    const daysSinceLastChange = (Date.now() - variable.lastChangedAt.getTime()) / (1000 * 60 * 60 * 24);
    const annualChangeAllowed = variable.annualCapPct * (daysSinceLastChange / 365);

    return changePct <= annualChangeAllowed;
  }

  /**
   * Apply a variable change
   */
  private async applyVariableChange(variableName: string, newValue: string): Promise<void> {
    const variable = await governanceRepository.getVariable(variableName);
    if (variable) {
      variable.value = newValue;
      variable.updatedAt = new Date();
      variable.lastChangedAt = new Date();
      await governanceRepository.saveVariable(variable);
      logger.info('Governance variable updated', { variable: variableName, newValue });
    }
  }

  /**
   * Distribute payouts for resolved market
   */
  private async distributePayouts(market: GovernanceMarket): Promise<void> {
    if (market.resolution === 'cap-blocked') {
      // Return all stakes for cap-blocked markets
      // In a real implementation, this would credit SUI back to bettors
      logger.info('All stakes returned for cap-blocked market', { marketId: market.id });
      return;
    }

    const winningSide = market.resolution;
    const winningPool = winningSide === 'yes' ? market.stakeYes : market.stakeNo;
    const losingPool = winningSide === 'yes' ? market.stakeNo : market.stakeYes;

    if (winningPool === 0) {
      // No winners, return stakes
      logger.info('No winning bets for market', { marketId: market.id });
      return;
    }

    // Update bet payouts
    const bets = await governanceRepository.getBetsForMarket(market.id);
    for (const bet of bets) {
      if (bet.side === winningSide) {
        // Winner gets their stake back + proportional share of losing pool
        bet.payout = bet.amount + (bet.amount / winningPool) * losingPool;
      } else {
        // Losers get nothing
        bet.payout = 0;
      }
      await governanceRepository.saveBet(bet);
    }
  }

  /**
   * Get default value for a governance variable
   */
  private getDefaultValueForVariable(name: string): string {
    const defaults: Record<string, string> = {
      'foundationShare': '0.5', // 50% to foundation
      'pmFundShare': '0.5' // 50% to PM fund
    };
    return defaults[name] || '0';
  }

  /**
   * Get value type for a governance variable
   */
  private getValueTypeForVariable(name: string): 'number' | 'percentage' | 'string' {
    if (name.includes('Share') || name.includes('Pct')) {
      return 'percentage';
    }
    if (name.includes('Price') || name.includes('Multiplier')) {
      return 'number';
    }
    return 'string';
  }

  /**
   * Get description for a governance variable
   */
  private getDescriptionForVariable(name: string): string {
    const descriptions: Record<string, string> = {
      'foundationShare': 'Percentage of platform revenue allocated to the foundation',
      'pmFundShare': 'Percentage of posting fees allocated to prediction markets'
    };
    return descriptions[name] || `Governance variable: ${name}`;
  }
}

export const governanceService = new GovernanceService();