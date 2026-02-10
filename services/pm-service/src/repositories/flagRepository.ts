import { SafetyFlag } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { pmDgraphClient } from './dgraphClient';

export class FlagRepository {
  async save(flag: SafetyFlag): Promise<void> {
    const mutation = {
      set: {
        uid: `_:${flag.id}`,
        dgraph_type: 'SafetyFlag',
        id: flag.id,
        dappId: flag.dappId,
        metric: flag.metric,
        description: flag.description,
        flaggedBy: flag.flaggedBy,
        createdAt: flag.createdAt.toISOString()
      }
    };

    await pmDgraphClient.mutate(mutation);
    logger.debug('Flag saved to Dgraph', { flagId: flag.id });
  }

  async findByDApp(dappId: string): Promise<SafetyFlag[]> {
    const query = `
      query flags($dappId: string) {
        flags(func: type(SafetyFlag)) @filter(eq(dappId, $dappId)) {
          id
          dappId
          metric
          description
          flaggedBy
          createdAt
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $dappId: dappId });

    return (result.flags || []).map((flag: any) => ({
      ...flag,
      createdAt: new Date(flag.createdAt)
    }));
  }

  async findById(id: string): Promise<SafetyFlag | null> {
    const query = `
      query flag($id: string) {
        flag(func: eq(id, $id)) @filter(type(SafetyFlag)) {
          id
          dappId
          metric
          description
          flaggedBy
          createdAt
        }
      }
    `;

    const result = await pmDgraphClient.query(query, { $id: id });
    const flag = result.flag?.[0];

    if (!flag) return null;

    return {
      ...flag,
      createdAt: new Date(flag.createdAt)
    };
  }
}

export const flagRepository = new FlagRepository();
