import { SafetyFlag } from '@dlux-sui/types';
import { logger } from '../utils/logger';

// In-memory storage for now - should be replaced with database
const flags = new Map<string, SafetyFlag>();

export class FlagRepository {
  async save(flag: SafetyFlag): Promise<void> {
    flags.set(flag.id, flag);
    logger.debug('Flag saved', { flagId: flag.id });
  }

  async findByDApp(dappId: string): Promise<SafetyFlag[]> {
    return Array.from(flags.values()).filter(f => f.dappId === dappId);
  }

  async findById(id: string): Promise<SafetyFlag | null> {
    return flags.get(id) || null;
  }
}

export const flagRepository = new FlagRepository();
