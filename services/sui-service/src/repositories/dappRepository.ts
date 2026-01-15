import { SUIdApp } from '@dlux-sui/types';
import { logger } from '../utils/logger';

// Simple in-memory repository - replace with database in production
class DAppRepository {
  private dapps = new Map<string, SUIdApp>();

  async save(dapp: SUIdApp): Promise<void> {
    try {
      this.dapps.set(dapp.id, {
        ...dapp,
        updatedAt: new Date()
      });
      logger.debug('Saved dApp', { id: dapp.id, name: dapp.name });
    } catch (error) {
      logger.error('Error saving dApp', { id: dapp.id, error });
      throw error;
    }
  }

  async findById(id: string): Promise<SUIdApp | null> {
    return this.dapps.get(id) || null;
  }

  async findByOwner(owner: string): Promise<SUIdApp[]> {
    return Array.from(this.dapps.values()).filter(dapp => dapp.owner === owner);
  }

  async findAll(limit = 100, offset = 0): Promise<SUIdApp[]> {
    const all = Array.from(this.dapps.values());
    return all.slice(offset, offset + limit);
  }

  async search(query: string): Promise<SUIdApp[]> {
    const all = Array.from(this.dapps.values());
    const lowerQuery = query.toLowerCase();
    return all.filter(dapp =>
      dapp.name.toLowerCase().includes(lowerQuery) ||
      dapp.description.toLowerCase().includes(lowerQuery) ||
      dapp.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async findByTags(tags: string[]): Promise<SUIdApp[]> {
    const all = Array.from(this.dapps.values());
    return all.filter(dapp =>
      tags.some(tag => dapp.tags.includes(tag))
    );
  }
}

export const dappRepository = new DAppRepository();