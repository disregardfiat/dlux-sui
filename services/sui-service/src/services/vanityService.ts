import { VanityAddress, UserProfile } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { profileRepository } from '../repositories/profileRepository';
import { suinsService } from './suinsService';

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

    const availability = await suinsService.isAvailable(vanity);
    if (availability === null) {
      throw new Error('SuiNS availability check is not configured');
    }
    return availability;
  }

  /**
   * Get vanity address information
   */
  async getInfo(vanity: string): Promise<VanityAddress | null> {
    return null;
  }

  /**
   * Purchase a vanity address via SUI blockchain
   */
  async purchase(
    vanity: string,
    suiAddress: string,
    signature: string,
    price: number
  ): Promise<{ transactionId: string }> {
    throw new Error('Vanity purchases are disabled. Use SuiNS for name registration.');
  }

  /**
   * Calculate price for vanity address (shorter = more expensive)
   */
  calculatePrice(vanity: string): number {
    return 0;
  }

  /**
   * Update user profile via SUI blockchain
   */
  async updateProfile(
    identifier: string,
    suiAddress: string,
    signature: string,
    profile: Partial<UserProfile>
  ): Promise<{ transactionId: string }> {
    // TODO: Verify signature
    // TODO: Create and submit SUI transaction for profile update

    // Resolve identity to owner
    let owner = suiAddress;
    let suinsName: string | undefined;

    if (!identifier.startsWith('0x')) {
      suinsName = identifier;
      const resolved = await suinsService.resolveName(identifier);
      if (resolved) {
        owner = resolved;
      }
    } else {
      owner = identifier;
      suinsName = await suinsService.reverseResolve(identifier) || undefined;
    }

    await profileRepository.upsertProfile(owner, {
      displayName: profile.displayName,
      bio: profile.bio,
      avatar: profile.avatar,
      banner: profile.banner,
      website: profile.website,
      location: profile.location,
      verified: profile.verified,
      socialLinks: profile.socialLinks,
      metadata: profile.metadata
    }, suinsName);

    // Mock SUI transaction - replace with actual blockchain interaction
    const transactionId = `profile_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Profile update transaction submitted', {
      identifier,
      suiAddress,
      transactionId
    });

    // Note: Actual persistence will happen via blockchain indexer
    // when the transaction is confirmed

    return { transactionId };
  }

  /**
   * Get user by vanity address or SUI address
   */
  async getUser(identifier: string): Promise<{
    owner: string;
    suinsName?: string;
    profile?: UserProfile;
  } | null> {
    let owner = identifier;
    let suinsName: string | undefined;

    if (identifier.startsWith('0x')) {
      owner = identifier;
      suinsName = await suinsService.reverseResolve(identifier) || undefined;
    } else {
      suinsName = identifier;
      const resolved = await suinsService.resolveName(identifier);
      if (!resolved) {
        return null;
      }
      owner = resolved;
    }

    let profileRecord: { suinsName?: string; profile?: any } | null = null;
    try {
      profileRecord = await profileRepository.findByOwner(owner);
    } catch (e) {
      // DGraph may be unavailable (e.g. "dGraph client not initialized"); return minimal profile from chain
    }

    return {
      owner,
      suinsName: profileRecord?.suinsName || suinsName,
      profile: profileRecord?.profile
    };
  }
}

export const vanityService = new VanityService();
