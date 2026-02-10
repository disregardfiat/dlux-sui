import { VanityAddress, UserProfile } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { suiDgraphClient } from './dgraphClient'; // Need to create this

const inMemoryVanities = new Map<string, VanityAddress & { profile?: UserProfile }>();
const isTestEnv = (): boolean => process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

export class VanityRepository {
  private parseJsonField<T>(value: unknown, fallback: T): T {
    if (!value || typeof value !== 'string') {
      return fallback;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn('Failed to parse profile JSON field', { value, error });
      return fallback;
    }
  }

  clearTestData(): void {
    if (isTestEnv()) {
      inMemoryVanities.clear();
    }
  }

  async save(vanity: VanityAddress): Promise<void> {
    if (isTestEnv()) {
      inMemoryVanities.set(vanity.address.toLowerCase(), {
        ...vanity,
        address: vanity.address.toLowerCase()
      });
      return;
    }

    const mutation = {
      set: {
        uid: `_:${vanity.address}`,
        dgraph_type: 'VanityNamespace',
        address: vanity.address.toLowerCase(),
        owner: vanity.owner,
        price: vanity.price,
        purchasedAt: vanity.purchasedAt.toISOString(),
        expiresAt: vanity.expiresAt ? vanity.expiresAt.toISOString() : null,
        verified: vanity.verified
      }
    };

    await suiDgraphClient.mutate(mutation);
    logger.debug('Vanity address saved to Dgraph', { vanity: vanity.address });
  }

  async findByVanity(vanity: string): Promise<(VanityAddress & { profile?: UserProfile }) | null> {
    if (isTestEnv()) {
      return inMemoryVanities.get(vanity.toLowerCase()) || null;
    }

    const query = `
      query vanity($address: string) {
        vanity(func: eq(address, $address)) @filter(type(VanityNamespace)) {
          address
          owner
          price
          purchasedAt
          expiresAt
          verified
          profile {
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
      }
    `;

    const result = await suiDgraphClient.query(query, { $address: vanity.toLowerCase() });
    const vanityData = result.vanity?.[0];

    if (!vanityData) return null;

    const profile = vanityData.profile
      ? (() => {
          const { socialLinksJson, metadataJson, ...restProfile } = vanityData.profile;
          return {
            ...restProfile,
            updatedAt: restProfile.updatedAt ? new Date(restProfile.updatedAt) : undefined,
            socialLinks: this.parseJsonField(socialLinksJson, []),
            metadata: this.parseJsonField(metadataJson, {})
          };
        })()
      : undefined;

    return {
      ...vanityData,
      purchasedAt: new Date(vanityData.purchasedAt),
      expiresAt: vanityData.expiresAt ? new Date(vanityData.expiresAt) : undefined,
      profile
    };
  }

  async findByOwner(suiAddress: string): Promise<(VanityAddress & { profile?: UserProfile }) | null> {
    if (isTestEnv()) {
      for (const vanity of inMemoryVanities.values()) {
        if (vanity.owner === suiAddress) {
          return vanity;
        }
      }
      return null;
    }

    const query = `
      query vanityByOwner($owner: string) {
        vanity(func: eq(owner, $owner)) @filter(type(VanityNamespace)) {
          address
          owner
          price
          purchasedAt
          expiresAt
          verified
          profile {
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
      }
    `;

    const result = await suiDgraphClient.query(query, { $owner: suiAddress });
    const vanityData = result.vanity?.[0];

    if (!vanityData) return null;

    const profile = vanityData.profile
      ? (() => {
          const { socialLinksJson, metadataJson, ...restProfile } = vanityData.profile;
          return {
            ...restProfile,
            updatedAt: restProfile.updatedAt ? new Date(restProfile.updatedAt) : undefined,
            socialLinks: this.parseJsonField(socialLinksJson, []),
            metadata: this.parseJsonField(metadataJson, {})
          };
        })()
      : undefined;

    return {
      ...vanityData,
      purchasedAt: new Date(vanityData.purchasedAt),
      expiresAt: vanityData.expiresAt ? new Date(vanityData.expiresAt) : undefined,
      profile
    };
  }

  async updateProfile(vanity: string, profile: UserProfile): Promise<void> {
    if (isTestEnv()) {
      const existing = inMemoryVanities.get(vanity.toLowerCase());
      if (!existing) {
        throw new Error('Vanity address not found');
      }
      inMemoryVanities.set(vanity.toLowerCase(), {
        ...existing,
        profile: {
          ...profile
        }
      });
      return;
    }

    // First find the vanity to get its UID
    const query = `
      query vanity($address: string) {
        vanity(func: eq(address, $address)) @filter(type(VanityNamespace)) {
          uid
        }
      }
    `;

    const result = await suiDgraphClient.query(query, { $address: vanity.toLowerCase() });
    const vanityData = result.vanity?.[0];

    if (!vanityData) {
      throw new Error('Vanity address not found');
    }

    // Create UserProfile node and link it
    const profileId = `${vanity.toLowerCase()}_profile`;
    const mutation = {
      set: {
        uid: vanityData.uid,
        profile: {
          uid: `_:${profileId}`,
          dgraph_type: 'UserProfile',
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
      }
    };

    await suiDgraphClient.mutate(mutation);
    logger.debug('Profile updated in Dgraph', { vanity });
  }

  async findAll(): Promise<(VanityAddress & { profile?: UserProfile })[]> {
    if (isTestEnv()) {
      return Array.from(inMemoryVanities.values());
    }

    const query = `
      query allVanities {
        vanities(func: type(VanityNamespace)) {
          address
          owner
          price
          purchasedAt
          expiresAt
          verified
          profile {
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
      }
    `;

    const result = await suiDgraphClient.query(query);

    return (result.vanities || []).map((vanity: any) => {
      const profile = vanity.profile
        ? (() => {
            const { socialLinksJson, metadataJson, ...restProfile } = vanity.profile;
            return {
              ...restProfile,
              updatedAt: restProfile.updatedAt ? new Date(restProfile.updatedAt) : undefined,
              socialLinks: this.parseJsonField(socialLinksJson, []),
              metadata: this.parseJsonField(metadataJson, {})
            };
          })()
        : undefined;

      return {
        ...vanity,
        purchasedAt: new Date(vanity.purchasedAt),
        expiresAt: vanity.expiresAt ? new Date(vanity.expiresAt) : undefined,
        profile
      };
    });
  }
}

export const vanityRepository = new VanityRepository();
