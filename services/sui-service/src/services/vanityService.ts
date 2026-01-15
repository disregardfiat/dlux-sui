import { VanityAddress, UserProfile } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { vanityRepository } from '../repositories/vanityRepository';

export class VanityService {
  /**
   * Validate vanity address format
   */
  private validateVanity(vanity: string): boolean {
    // 3-20 characters, URL-safe (alphanumeric, hyphen, underscore)
    const pattern = /^[a-zA-Z0-9_-]{3,20}$/;
    return pattern.test(vanity);
  }

  /**
   * Check if vanity address is available
   */
  async isAvailable(vanity: string): Promise<boolean> {
    if (!this.validateVanity(vanity)) {
      throw new Error('Invalid vanity address format. Must be 3-20 characters, URL-safe (alphanumeric, hyphen, underscore)');
    }

    const existing = await vanityRepository.findByVanity(vanity);
    return !existing || !!(existing.expiresAt && existing.expiresAt < new Date());
  }

  /**
   * Get vanity address information
   */
  async getInfo(vanity: string): Promise<VanityAddress | null> {
    return await vanityRepository.findByVanity(vanity);
  }

  /**
   * Purchase a vanity address
   */
  async purchase(
    vanity: string,
    suiAddress: string,
    signature: string,
    price: number
  ): Promise<VanityAddress> {
    if (!this.validateVanity(vanity)) {
      throw new Error('Invalid vanity address format');
    }

    // TODO: Verify signature and payment on SUI blockchain
    // For now, we'll just store it
    
    const existing = await vanityRepository.findByVanity(vanity);
    if (existing && existing.owner !== suiAddress) {
      if (!existing.expiresAt || existing.expiresAt > new Date()) {
        throw new Error('Vanity address is already taken');
      }
    }

    const vanityAddr: VanityAddress = {
      address: vanity.toLowerCase(),
      owner: suiAddress,
      price: price || this.calculatePrice(vanity),
      purchasedAt: new Date(),
      verified: true
    };

    await vanityRepository.save(vanityAddr);
    logger.info('Vanity address purchased', { vanity, owner: suiAddress });

    return vanityAddr;
  }

  /**
   * Calculate price for vanity address (shorter = more expensive)
   */
  calculatePrice(vanity: string): number {
    const length = vanity.length;
    // Base price increases exponentially for shorter addresses
    // 3 chars = 1000 SUI, 20 chars = 1 SUI
    const basePrice = Math.pow(10, 4 - length);
    return Math.max(1, Math.floor(basePrice));
  }

  /**
   * Update user profile
   */
  async updateProfile(
    vanity: string,
    suiAddress: string,
    signature: string,
    profile: Partial<UserProfile>
  ): Promise<UserProfile> {
    const vanityAddr = await vanityRepository.findByVanity(vanity);
    
    if (!vanityAddr) {
      throw new Error('Vanity address not found');
    }

    if (vanityAddr.owner !== suiAddress) {
      throw new Error('Not authorized to update this profile');
    }

    // TODO: Verify signature

    const existingProfile = vanityAddr.profile || {};
    const updatedProfile: UserProfile = {
      ...existingProfile,
      ...profile
    };

    await vanityRepository.updateProfile(vanity, updatedProfile);
    logger.info('Profile updated', { vanity, suiAddress });

    return updatedProfile;
  }

  /**
   * Get user by vanity address or SUI address
   */
  async getUser(identifier: string): Promise<{
    owner: string;
    address?: string;
    profile?: UserProfile;
  } | null> {
    // Try vanity address first
    const vanity = await vanityRepository.findByVanity(identifier.toLowerCase());
    if (vanity) {
      return {
        owner: vanity.owner,
        address: vanity.address,
        profile: vanity.profile
      };
    }

    // Try SUI address
    const byAddress = await vanityRepository.findByOwner(identifier);
    if (byAddress) {
      return {
        owner: identifier,
        address: byAddress.address,
        profile: byAddress.profile
      };
    }

    // Return basic info for SUI address even if no vanity
    return {
      owner: identifier
    };
  }
}

export const vanityService = new VanityService();
