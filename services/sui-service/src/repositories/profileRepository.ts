import { UserProfile } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { suiDgraphClient } from './dgraphClient';

const inMemoryProfiles = new Map<string, { owner: string; suinsName?: string; profile: UserProfile }>();
const isTestEnv = (): boolean => process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

type StoredProfile = {
  owner: string;
  suinsName?: string;
  profile: UserProfile;
};

export class ProfileRepository {
  clearTestData(): void {
    if (isTestEnv()) {
      inMemoryProfiles.clear();
    }
  }

  async upsertProfile(owner: string, profile: UserProfile, suinsName?: string): Promise<void> {
    if (isTestEnv()) {
      inMemoryProfiles.set(owner, { owner, suinsName, profile });
      return;
    }

    const mutation = {
      set: {
        uid: `_:user_profile_${owner}`,
        dgraph_type: 'UserProfile',
        owner,
        suinsName,
        displayName: profile.displayName,
        bio: profile.bio,
        avatar: profile.avatar,
        banner: profile.banner,
        website: profile.website,
        location: profile.location,
        socialLinksJson: profile.socialLinks ? JSON.stringify(profile.socialLinks) : null,
        metadataJson: profile.metadata ? JSON.stringify(profile.metadata) : null,
        updatedAt: new Date().toISOString()
      }
    };

    await suiDgraphClient.mutate(mutation);
    logger.debug('User profile saved to Dgraph', { owner, suinsName });
  }

  async findByOwner(owner: string): Promise<StoredProfile | null> {
    if (isTestEnv()) {
      return inMemoryProfiles.get(owner) || null;
    }

    const query = `
      query userProfile($owner: string) {
        profiles(func: type(UserProfile)) @filter(eq(owner, $owner)) {
          owner
          suinsName
          displayName
          bio
          avatar
          banner
          website
          location
          socialLinksJson
          metadataJson
          updatedAt
        }
      }
    `;

    const result = await suiDgraphClient.query(query, { $owner: owner });
    const profileData = result.profiles?.[0];

    if (!profileData) return null;

    let socialLinks = [];
    let metadata = {};
    try {
      socialLinks = profileData.socialLinksJson ? JSON.parse(profileData.socialLinksJson) : [];
    } catch (error) {
      logger.warn('Failed to parse socialLinksJson', { owner, error });
    }

    try {
      metadata = profileData.metadataJson ? JSON.parse(profileData.metadataJson) : {};
    } catch (error) {
      logger.warn('Failed to parse metadataJson', { owner, error });
    }

    return {
      owner: profileData.owner,
      suinsName: profileData.suinsName || undefined,
      profile: {
        displayName: profileData.displayName,
        bio: profileData.bio,
        avatar: profileData.avatar,
        banner: profileData.banner,
        website: profileData.website,
        location: profileData.location,
        socialLinks,
        metadata
      }
    };
  }
}

export const profileRepository = new ProfileRepository();
