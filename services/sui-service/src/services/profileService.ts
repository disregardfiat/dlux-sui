import { UserProfile } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { profileRepository } from '../repositories/profileRepository';
import { suinsService } from './suinsService';

/**
 * Profile service: resolve SuiNS/address to owner and read/write profile via Dgraph.
 * Replaces the former vanity service (SuiNS is the source of truth for names).
 */
export class ProfileService {
  /**
   * Get user by identifier (SuiNS name or SUI address).
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

    let profileRecord: { suinsName?: string; profile?: UserProfile } | null = null;
    try {
      profileRecord = await profileRepository.findByOwner(owner);
    } catch (e) {
      // DGraph may be unavailable; return minimal response
      logger.debug('ProfileRepository.findByOwner failed', { owner, error: e });
    }

    return {
      owner,
      suinsName: profileRecord?.suinsName ?? suinsName,
      profile: profileRecord?.profile
    };
  }

  /**
   * Update user profile. Caller must ensure authorization (e.g. JWT or signature).
   */
  async updateProfile(
    identifier: string,
    ownerAddress: string,
    profile: Partial<UserProfile>
  ): Promise<{ transactionId: string }> {
    let owner = ownerAddress;
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

    const transactionId = `profile_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info('Profile update saved', { identifier, owner, transactionId });
    return { transactionId };
  }
}

export const profileService = new ProfileService();
