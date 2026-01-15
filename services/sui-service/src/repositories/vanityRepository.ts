import { VanityAddress, UserProfile } from '@dlux-sui/types';
import { logger } from '../utils/logger';

// In-memory storage - replace with database in production
const vanityAddresses = new Map<string, VanityAddress & { profile?: UserProfile }>();
const ownerToVanity = new Map<string, string>(); // Map SUI address to vanity

export class VanityRepository {
  async save(vanity: VanityAddress): Promise<void> {
    vanityAddresses.set(vanity.address.toLowerCase(), {
      ...vanity,
      profile: undefined
    });
    ownerToVanity.set(vanity.owner, vanity.address.toLowerCase());
    logger.debug('Vanity address saved', { vanity: vanity.address });
  }

  async findByVanity(vanity: string): Promise<(VanityAddress & { profile?: UserProfile }) | null> {
    return vanityAddresses.get(vanity.toLowerCase()) || null;
  }

  async findByOwner(suiAddress: string): Promise<(VanityAddress & { profile?: UserProfile }) | null> {
    const vanityAddr = ownerToVanity.get(suiAddress);
    if (vanityAddr) {
      return vanityAddresses.get(vanityAddr) || null;
    }
    return null;
  }

  async updateProfile(vanity: string, profile: UserProfile): Promise<void> {
    const existing = vanityAddresses.get(vanity.toLowerCase());
    if (existing) {
      existing.profile = { ...existing.profile, ...profile };
      vanityAddresses.set(vanity.toLowerCase(), existing);
      logger.debug('Profile updated', { vanity });
    } else {
      throw new Error('Vanity address not found');
    }
  }

  async findAll(): Promise<(VanityAddress & { profile?: UserProfile })[]> {
    return Array.from(vanityAddresses.values());
  }
}

export const vanityRepository = new VanityRepository();
