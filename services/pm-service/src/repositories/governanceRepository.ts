import {
  GovernanceVariable,
  GovernanceMarket,
  GovernanceBet
} from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { pmDgraphClient } from './dgraphClient';

export class GovernanceRepository {
  // Governance Variables
  async saveVariable(variable: GovernanceVariable): Promise<void> {
    const mutation = {
      set: {
        uid: `_:${variable.name}`,
        dgraph_type: 'GovernanceVariable',
        name: variable.name,
        value: variable.value,
        valueType: variable.valueType,
        updatedAt: variable.updatedAt.toISOString(),
        lastChangedAt: variable.lastChangedAt.toISOString(),
        annualCapPct: variable.annualCapPct,
        description: variable.description
      }
    };

    await pmDgraphClient.mutate(mutation);
    logger.debug('Governance variable saved to Dgraph', { variable: variable.name });
  }

  async getVariable(name: string): Promise<GovernanceVariable | null> {
    const query = `
      query variable($name: string) {
        variable(func: eq(name, $name)) @filter(type(GovernanceVariable)) {
          name
          value
          valueType
          updatedAt
          lastChangedAt
          annualCapPct
          description
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $name: name });
    const variable = result.variable?.[0];

    if (!variable) return null;

    return {
      ...variable,
      updatedAt: new Date(variable.updatedAt),
      lastChangedAt: new Date(variable.lastChangedAt)
    };
  }

  async getAllVariables(): Promise<GovernanceVariable[]> {
    const query = `
      query allVariables {
        variables(func: type(GovernanceVariable)) {
          name
          value
          valueType
          updatedAt
          lastChangedAt
          annualCapPct
          description
        }
      }
    `;

    const result = await pmDgraphClient.query(query);

    return (result.variables || []).map((variable: any) => ({
      ...variable,
      updatedAt: new Date(variable.updatedAt),
      lastChangedAt: new Date(variable.lastChangedAt)
    }));
  }

  // Governance Markets
  async saveMarket(market: GovernanceMarket): Promise<void> {
    const mutation = {
      set: {
        uid: `_:${market.id}`,
        dgraph_type: 'GovernanceMarket',
        id: market.id,
        variable: market.variable,
        proposedValue: market.proposedValue,
        stakeYes: market.stakeYes,
        stakeNo: market.stakeNo,
        createdAt: market.createdAt.toISOString(),
        expiresAt: market.expiresAt.toISOString(),
        resolvedAt: market.resolvedAt ? market.resolvedAt.toISOString() : null,
        resolution: market.resolution,
        triggeredBy: market.triggeredBy,
        triggeredByAddress: market.triggeredByAddress
      }
    };

    await pmDgraphClient.mutate(mutation);
    logger.debug('Governance market saved to Dgraph', { marketId: market.id });
  }

  async getMarket(marketId: string): Promise<GovernanceMarket | null> {
    const query = `
      query market($id: string) {
        market(func: eq(id, $id)) @filter(type(GovernanceMarket)) {
          id
          variable
          proposedValue
          stakeYes
          stakeNo
          createdAt
          expiresAt
          resolvedAt
          resolution
          triggeredBy
          triggeredByAddress
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $id: marketId });
    const market = result.market?.[0];

    if (!market) return null;

    return {
      ...market,
      createdAt: new Date(market.createdAt),
      expiresAt: new Date(market.expiresAt),
      resolvedAt: market.resolvedAt ? new Date(market.resolvedAt) : undefined
    };
  }

  async getActiveMarkets(): Promise<GovernanceMarket[]> {
    const now = new Date().toISOString();

    const query = `
      query activeMarkets($now: datetime) {
        markets(func: type(GovernanceMarket)) @filter(NOT has(resolvedAt) AND gt(expiresAt, $now)) {
          id
          variable
          proposedValue
          stakeYes
          stakeNo
          createdAt
          expiresAt
          triggeredBy
          triggeredByAddress
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $now: now });

    return (result.markets || []).map((market: any) => ({
      ...market,
      createdAt: new Date(market.createdAt),
      expiresAt: new Date(market.expiresAt)
    }));
  }

  async getActiveMarketForVariable(variableName: string): Promise<GovernanceMarket | null> {
    const now = new Date().toISOString();

    const query = `
      query activeMarketForVariable($variable: string, $now: datetime) {
        market(func: type(GovernanceMarket)) @filter(
          eq(variable, $variable) AND
          NOT has(resolvedAt) AND
          gt(expiresAt, $now)
        ) {
          id
          variable
          proposedValue
          stakeYes
          stakeNo
          createdAt
          expiresAt
          triggeredBy
          triggeredByAddress
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $variable: variableName, $now: now });
    const market = result.market?.[0];

    if (!market) return null;

    return {
      ...market,
      createdAt: new Date(market.createdAt),
      expiresAt: new Date(market.expiresAt)
    };
  }

  // Governance Bets
  async saveBet(bet: GovernanceBet): Promise<void> {
    const mutation = {
      set: {
        uid: `_:${bet.id}`,
        dgraph_type: 'GovernanceBet',
        id: bet.id,
        marketId: bet.marketId,
        bettor: bet.bettor,
        side: bet.side,
        amount: bet.amount,
        shares: bet.shares,
        createdAt: bet.createdAt.toISOString(),
        payout: bet.payout || null
      }
    };

    await pmDgraphClient.mutate(mutation);
    logger.debug('Governance bet saved to Dgraph', { betId: bet.id });
  }

  async getBetsForMarket(marketId: string): Promise<GovernanceBet[]> {
    const query = `
      query betsForMarket($marketId: string) {
        bets(func: type(GovernanceBet)) @filter(eq(marketId, $marketId)) {
          id
          marketId
          bettor
          side
          amount
          shares
          createdAt
          payout
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $marketId: marketId });

    return (result.bets || []).map((bet: any) => ({
      ...bet,
      createdAt: new Date(bet.createdAt)
    }));
  }
}

export const governanceRepository = new GovernanceRepository();