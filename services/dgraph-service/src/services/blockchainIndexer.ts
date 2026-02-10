import axios from 'axios';
import { logger } from '../utils/logger';
import { dgraphClient } from '../dgraph/client';

const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || process.env.WALRUS_BASE_URL || 'http://localhost:3002';

/** PM duration — same env var as markets.ts. Falls back to 3 days. */
const PM_DURATION_MS = Number(process.env.PM_DURATION_MS) || 3 * 24 * 60 * 60 * 1000;

// Mock SUI client for now - replace with actual SUI SDK integration
class MockSuiClient {
  async getLatestEvents(): Promise<any[]> {
    // Mock events - replace with actual SUI event querying
    return [];
  }

  async getTransaction(txId: string): Promise<any> {
    // Mock transaction data - replace with actual SUI transaction fetching
    return null;
  }
}

const mockSuiClient = new MockSuiClient();

export class BlockchainIndexer {
  private isRunning = false;
  private lastProcessedTx = 0;

  /**
   * Start the blockchain indexer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Blockchain indexer already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting blockchain indexer');

    // Initial sync - process historical data
    await this.initialSync();

    // Start continuous monitoring
    this.monitorBlockchain();
  }

  /**
   * Stop the blockchain indexer
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('Stopped blockchain indexer');
  }

  /**
   * Perform initial sync of historical blockchain data
   */
  private async initialSync(): Promise<void> {
    try {
      logger.info('Starting initial blockchain sync');

      // TODO: Query historical events from SUI blockchain
      // - Vanity namespace registrations
      // - dApp postings
      // - Prediction market creations
      // - ZK proof linkages

      // For now, this is a placeholder
      logger.info('Initial blockchain sync completed');
    } catch (error) {
      logger.error('Initial sync failed', error);
    }
  }

  /**
   * Continuously monitor blockchain for new events
   */
  private async monitorBlockchain(): Promise<void> {
    const pollInterval = parseInt(process.env.BLOCKCHAIN_INDEXER_POLL_INTERVAL || '30000', 10);

    while (this.isRunning) {
      try {
        await this.processNewEvents();
      } catch (error) {
        logger.error('Error processing blockchain events', error);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Process new blockchain events and sync to Dgraph
   */
  private async processNewEvents(): Promise<void> {
    try {
      // Get latest events from SUI blockchain
      const events = await mockSuiClient.getLatestEvents();

      for (const event of events) {
        await this.processEvent(event);
      }

      // Update last processed transaction
      if (events.length > 0) {
        this.lastProcessedTx = Math.max(this.lastProcessedTx, ...events.map(e => e.txSequence || 0));
      }
    } catch (error) {
      logger.error('Failed to process new events', error);
    }
  }

  /**
   * Process individual blockchain event and sync to Dgraph
   */
  private async processEvent(event: any): Promise<void> {
    try {
      const eventType = this.getEventType(event);

      switch (eventType) {
        case 'vanity_registered':
          await this.syncVanityRegistration(event);
          break;

        case 'dapp_posted':
          await this.syncDAppPosting(event);
          break;

        case 'prediction_market_created':
          await this.syncPredictionMarket(event);
          break;

        case 'zk_proof_linked':
          await this.syncZKProof(event);
          break;

        case 'profile_updated':
          await this.syncProfileUpdate(event);
          break;

        default:
          logger.debug('Unknown event type, skipping', { eventType });
      }
    } catch (error) {
      logger.error('Failed to process event', { event, error });
    }
  }

  /**
   * Determine event type from blockchain event
   */
  private getEventType(event: any): string {
    // TODO: Parse actual SUI event types
    // This is a placeholder implementation
    if (event.type?.includes('vanity')) return 'vanity_registered';
    if (event.type?.includes('dapp')) return 'dapp_posted';
    if (event.type?.includes('prediction')) return 'prediction_market_created';
    if (event.type?.includes('zk')) return 'zk_proof_linked';
    if (event.type?.includes('profile')) return 'profile_updated';
    return 'unknown';
  }

  /**
   * Sync vanity namespace registration from blockchain to Dgraph
   */
  private async syncVanityRegistration(event: any): Promise<void> {
    const vanityData = {
      address: event.data.vanityAddress,
      owner: event.data.owner,
      price: event.data.price,
      purchasedAt: new Date(event.timestamp),
      verified: true
    };

    // Check if already exists
    const existing = await this.getVanityFromDgraph(vanityData.address);
    if (existing) {
      logger.debug('Vanity already synced', { vanity: vanityData.address });
      return;
    }

    // Sync to Dgraph
    const mutation = {
      set: {
        uid: `_:vanity_${vanityData.address}`,
        dgraph_type: 'VanityNamespace',
        address: vanityData.address,
        owner: vanityData.owner,
        price: vanityData.price,
        purchasedAt: vanityData.purchasedAt.toISOString(),
        verified: vanityData.verified
      }
    };

    await dgraphClient.mutate(mutation);
    logger.info('Synced vanity registration to Dgraph', { vanity: vanityData.address });
  }

  /**
   * Resolve manifest when it is a walrus:blobId reference (full manifest stored in Walrus to save tx size).
   */
  private async resolveManifest(manifestRaw: any): Promise<{ manifest: any; manifestJson: string }> {
    const str = typeof manifestRaw === 'string' ? manifestRaw : (manifestRaw ? JSON.stringify(manifestRaw) : '{}');
    const walrusPrefix = 'walrus:';
    if (str.startsWith(walrusPrefix)) {
      const blobId = str.slice(walrusPrefix.length).trim();
      if (!blobId) return { manifest: {}, manifestJson: '{}' };
      try {
        const res = await axios.get(`${WALRUS_SERVICE_URL.replace(/\/$/, '')}/blobs/${encodeURIComponent(blobId)}`, {
          responseType: 'arraybuffer',
          validateStatus: () => true
        });
        if (res.status === 200) {
          const text = new TextDecoder().decode(res.data);
          let manifest: any;
          try {
            manifest = JSON.parse(text);
          } catch {
            manifest = { raw: text };
          }
          return { manifest, manifestJson: typeof manifest === 'object' ? JSON.stringify(manifest) : text };
        }
      } catch (err) {
        logger.warn('Walrus manifest resolve failed in indexer', { blobId, error: err });
      }
      return { manifest: { raw: str }, manifestJson: JSON.stringify({ raw: str }) };
    }
    const manifest = typeof manifestRaw === 'object' ? manifestRaw : (() => { try { return JSON.parse(str); } catch { return {}; } })();
    return { manifest, manifestJson: typeof manifest === 'object' ? JSON.stringify(manifest) : str };
  }

  /**
   * Sync dApp posting from blockchain to Dgraph
   * Resolves walrus:blobId manifest so pathMap and full metadata are stored (manifestJson).
   */
  private async syncDAppPosting(event: any): Promise<void> {
    const rawManifest = event.data.manifest;
    const { manifest, manifestJson } = await this.resolveManifest(rawManifest);

    const dappData = {
      id: event.data.dappId,
      name: event.data.name,
      description: event.data.description,
      owner: event.data.owner,
      permlink: event.data.permlink,
      version: event.data.version,
      manifest,
      manifestJson,
      blobIds: event.data.blobIds,
      tags: event.data.tags,
      category: event.data.category,
      createdAt: new Date(event.timestamp)
    };

    // Check if already exists
    const existing = await this.getDAppFromDgraph(dappData.id);
    if (existing) {
      logger.debug('dApp already synced', { dappId: dappData.id });
      return;
    }

    // Sync to Dgraph (manifestJson preserves pathMap and full structure)
    const mutation = {
      set: {
        uid: `_:dapp_${dappData.id}`,
        dgraph_type: 'DApp',
        id: dappData.id,
        name: dappData.name,
        description: dappData.description,
        owner: dappData.owner,
        permlink: dappData.permlink,
        version: dappData.version,
        manifestJson: dappData.manifestJson,
        blobIds: dappData.blobIds,
        tags: dappData.tags,
        category: dappData.category,
        rating: 0,
        downloadCount: 0,
        createdAt: dappData.createdAt.toISOString(),
        updatedAt: dappData.createdAt.toISOString()
      }
    };

    await dgraphClient.mutate(mutation);

    // Create associated prediction market
    if (event.data.predictionMarketId) {
      await this.syncPredictionMarket({
        data: {
          marketId: event.data.predictionMarketId,
          dappId: dappData.id,
          safetyMetric: 'posting',
          description: `Safety review for dApp: ${dappData.name}`,
          postingFeeContribution: event.data.postingFeeContribution,
          triggeredBy: 'posting',
          triggeredByAddress: event.data.owner
        },
        timestamp: event.timestamp
      });
    }

    logger.info('Synced dApp posting to Dgraph', { dappId: dappData.id });
  }

  /**
   * Sync prediction market creation from blockchain to Dgraph
   */
  private async syncPredictionMarket(event: any): Promise<void> {
    const marketData = {
      id: event.data.marketId,
      dappId: event.data.dappId,
      safetyMetric: event.data.safetyMetric,
      description: event.data.description,
      status: 'open',
      resolution: null,
      totalPool: event.data.postingFeeContribution || 0,
      safePool: event.data.postingFeeContribution || 0,
      unsafePool: 0,
      postingFeeContribution: event.data.postingFeeContribution || 0,
      recommendedAge: event.data.recommendedAge,
      createdAt: new Date(event.timestamp),
      expiresAt: new Date(event.timestamp + PM_DURATION_MS),
      resolvedAt: null,
      triggeredBy: event.data.triggeredBy,
      triggeredByAddress: event.data.triggeredByAddress
    };

    // Check if already exists
    const existing = await this.getPredictionMarketFromDgraph(marketData.id);
    if (existing) {
      logger.debug('Prediction market already synced', { marketId: marketData.id });
      return;
    }

    // Sync to Dgraph
    const mutation = {
      set: {
        uid: `_:market_${marketData.id}`,
        dgraph_type: 'PredictionMarket',
        id: marketData.id,
        dappId: marketData.dappId,
        safetyMetric: marketData.safetyMetric,
        description: marketData.description,
        status: marketData.status,
        resolution: marketData.resolution,
        totalPool: marketData.totalPool,
        safePool: marketData.safePool,
        unsafePool: marketData.unsafePool,
        postingFeeContribution: marketData.postingFeeContribution,
        recommendedAge: marketData.recommendedAge,
        createdAt: marketData.createdAt.toISOString(),
        expiresAt: marketData.expiresAt.toISOString(),
        resolvedAt: marketData.resolvedAt,
        triggeredBy: marketData.triggeredBy,
        triggeredByAddress: marketData.triggeredByAddress
      }
    };

    await dgraphClient.mutate(mutation);
    logger.info('Synced prediction market to Dgraph', { marketId: marketData.id });
  }

  /**
   * Sync ZK proof linkage from blockchain to Dgraph
   */
  private async syncZKProof(event: any): Promise<void> {
    const zkData = {
      suiAddress: event.data.suiAddress,
      provider: event.data.provider,
      proof: event.data.proof,
      linkedAt: new Date(event.timestamp)
    };

    // Get or create user
    let userUid = await this.getUserUidFromDgraph(zkData.suiAddress);
    if (!userUid) {
      // Create user if doesn't exist
      const userMutation = {
        set: {
          uid: `_:user_${zkData.suiAddress}`,
          dgraph_type: 'User',
          suiAddress: zkData.suiAddress,
          linkedZKPs: [],
          createdAt: zkData.linkedAt.toISOString(),
          updatedAt: zkData.linkedAt.toISOString()
        }
      };
      const result = await dgraphClient.mutate(userMutation);
      userUid = Object.values(result.uids)[0] as string | null;
    }

    // Add ZK proof to user
    const zkMutation = {
      set: {
        uid: userUid,
        linkedZKPs: {
          dgraph_type: 'ZKLink',
          provider: zkData.provider,
          proof: zkData.proof,
          linkedAt: zkData.linkedAt.toISOString()
        }
      }
    };

    await dgraphClient.mutate(zkMutation);
    logger.info('Synced ZK proof linkage to Dgraph', {
      suiAddress: zkData.suiAddress,
      provider: zkData.provider
    });
  }

  /**
   * Sync profile update from blockchain to Dgraph
   */
  private async syncProfileUpdate(event: any): Promise<void> {
    const profileData = {
      suiAddress: event.data.suiAddress,
      vanityAddress: event.data.vanityAddress,
      displayName: event.data.displayName,
      bio: event.data.bio,
      avatar: event.data.avatar,
      banner: event.data.banner,
      website: event.data.website,
      location: event.data.location,
      verified: event.data.verified,
      updatedAt: new Date(event.timestamp)
    };

    // Get vanity namespace UID
    const vanityUid = await this.getVanityUidFromDgraph(profileData.vanityAddress || profileData.suiAddress);
    if (!vanityUid) {
      logger.warn('Vanity namespace not found for profile update', {
        suiAddress: profileData.suiAddress,
        vanityAddress: profileData.vanityAddress
      });
      return;
    }

    // Update profile
    const profileMutation = {
      set: {
        uid: vanityUid,
        profile: {
          dgraph_type: 'UserProfile',
          displayName: profileData.displayName,
          bio: profileData.bio,
          avatar: profileData.avatar,
          banner: profileData.banner,
          website: profileData.website,
          location: profileData.location,
          updatedAt: profileData.updatedAt.toISOString()
        }
      }
    };

    await dgraphClient.mutate(profileMutation);
    logger.info('Synced profile update to Dgraph', { suiAddress: profileData.suiAddress });
  }

  // Helper methods to check existing data
  private async getVanityFromDgraph(address: string): Promise<any> {
    const query = `
      query vanity($address: string) {
        vanity(func: eq(address, $address)) @filter(type(VanityNamespace)) {
          uid
        }
      }
    `;
    const result = await dgraphClient.query(query, { $address: address.toLowerCase() });
    return result.vanity?.[0];
  }

  private async getDAppFromDgraph(id: string): Promise<any> {
    const query = `
      query dapp($id: string) {
        dapp(func: eq(id, $id)) @filter(type(DApp)) {
          uid
        }
      }
    `;
    const result = await dgraphClient.query(query, { $id: id });
    return result.dapp?.[0];
  }

  private async getPredictionMarketFromDgraph(id: string): Promise<any> {
    const query = `
      query market($id: string) {
        market(func: eq(id, $id)) @filter(type(PredictionMarket)) {
          uid
        }
      }
    `;
    const result = await dgraphClient.query(query, { $id: id });
    return result.market?.[0];
  }

  private async getUserUidFromDgraph(suiAddress: string): Promise<string | null> {
    const query = `
      query user($suiAddress: string) {
        user(func: eq(suiAddress, $suiAddress)) @filter(type(User)) {
          uid
        }
      }
    `;
    const result = await dgraphClient.query(query, { $suiAddress: suiAddress });
    return result.user?.[0]?.uid || null;
  }

  private async getVanityUidFromDgraph(identifier: string): Promise<string | null> {
    // Try vanity address first, then SUI address
    let query = `
      query vanity($address: string) {
        vanity(func: eq(address, $address)) @filter(type(VanityNamespace)) {
          uid
        }
      }
    `;
    let result = await dgraphClient.query(query, { $address: identifier.toLowerCase() });
    if (result.vanity?.[0]) return result.vanity[0].uid;

    // Try as owner
    query = `
      query vanity($owner: string) {
        vanity(func: eq(owner, $owner)) @filter(type(VanityNamespace)) {
          uid
        }
      }
    `;
    result = await dgraphClient.query(query, { $owner: identifier });
    return result.vanity?.[0]?.uid || null;
  }
}

export const blockchainIndexer = new BlockchainIndexer();