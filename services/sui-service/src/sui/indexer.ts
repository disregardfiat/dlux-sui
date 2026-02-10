import { existsSync, unlinkSync } from 'fs';
import { SuiEvent } from '@mysten/sui/client';
import { logger } from '../utils/logger';
import { suiClient } from './client';
import { textObjectProcessor } from './processors/textObjectProcessor';
import { dappProcessor } from './processors/dappProcessor';
import { dappRepository } from '../repositories/dappRepository';

/** Indexer stats exposed for health checks */
export interface IndexerStats {
  lastPollAt: string | null;
  lastEventId: string | null;
  eventsProcessed: number;
  filterInUse: string;
  packageId: string | null;
  isRunning: boolean;
  mode: 'stream' | 'poll';
}

class SUIIndexer {
  private isRunning = false;
  private abortController: AbortController | null = null;
  private unsubscribe: (() => Promise<boolean>) | null = null;
  private lastPollAt: string | null = null;
  private lastEventId: string | null = null;
  private eventsProcessed = 0;

  /** Modules to subscribe to. Default: all 5 in the package (metadata_pm, dapp_posting, ad_campaigns, ad_payments, ad_tracking). */
  private getModules(): string[] {
    const envModule = process.env.SUI_EVENT_MODULE;
    if (envModule) return envModule.split(',').map(m => m.trim());
    return ['metadata_pm', 'dapp_posting', 'ad_campaigns', 'ad_payments', 'ad_tracking'];
  }

  getStats(): IndexerStats {
    const packageId = process.env.SUI_PACKAGE_ID || null;
    const modules = this.getModules();
    const mode = process.env.INDEXER_MODE === 'stream' ? 'stream' : 'poll';
    const filterInUse = packageId
      ? modules.map(m => `MoveEventModule(${packageId}::${m})`).join(', ')
      : 'DISABLED - set SUI_PACKAGE_ID to filter by namespace';

    return {
      lastPollAt: this.lastPollAt,
      lastEventId: this.lastEventId,
      eventsProcessed: this.eventsProcessed,
      filterInUse,
      packageId,
      isRunning: this.isRunning,
      mode
    };
  }

  /**
   * If CLEAR_DAPPS_SENTINEL is set and that file exists (deploy -dump), clear in-memory dApps
   * then backfill from the most recent chain events so new posts (and recent ones) show up.
   * This runs on every startup, so running -dump multiple times will always backfill.
   */
  private async clearDappsAndSeedCursorIfRequested(): Promise<void> {
    const sentinelPath = process.env.CLEAR_DAPPS_SENTINEL;
    if (!sentinelPath || !existsSync(sentinelPath)) {
      return;
    }
    logger.info('Clear-dapps sentinel found; clearing in-memory dApps and backfilling recent events');
    dappRepository.clearTestData();
    try {
      unlinkSync(sentinelPath);
    } catch (e) {
      logger.warn('Could not remove clear-dapps sentinel file', { path: sentinelPath, error: e });
    }
    await this.backfillRecentEvents();
  }

  /** Fetch and process the most recent events (e.g. after clear on -dump) so recent dApps show up. */
  async backfillRecentEvents(): Promise<void> {
    const prev = this.lastEventId;
    this.lastEventId = null;
    try {
      logger.info('Starting backfill from chain events...');
      const events = await this.queryRecentEvents();
      logger.info('Found events to process', { count: events.length });
      
      if (events.length === 0) {
        logger.warn('No events found during backfill - check SUI_PACKAGE_ID and that events exist on chain');
        return;
      }

      // Process events in chronological order (oldest first) to ensure proper cursor tracking
      // Events from queryRecentEvents are already sorted by module, but we need to sort by timestamp
      const sortedEvents = [...events].sort((a, b) => {
        const aTime = a.timestampMs ? Number(a.timestampMs) : 0;
        const bTime = b.timestampMs ? Number(b.timestampMs) : 0;
        return aTime - bTime;
      });

      let processedCount = 0;
      for (const event of sortedEvents) {
        try {
          await this.processEvent(event);
          this.eventsProcessed += 1;
          processedCount += 1;
          // Update cursor to the latest processed event
          if (event.id?.txDigest) {
            this.lastEventId = `${event.id.txDigest}:${event.id.eventSeq}`;
          }
        } catch (error) {
          logger.error('Error processing event during backfill', { 
            eventId: event.id, 
            type: event.type, 
            error 
          });
          // Continue processing other events even if one fails
        }
      }
      
      if (processedCount > 0) {
        logger.info('Backfilled events successfully', { 
          total: events.length, 
          processed: processedCount, 
          lastEventId: this.lastEventId 
        });
      } else {
        logger.warn('Backfill found events but none were processed successfully');
      }
    } catch (error) {
      logger.error('Failed to backfill recent events', { error });
      throw error;
    } finally {
      if (this.lastEventId === null) this.lastEventId = prev;
    }
  }

  /** Backfill in-memory dApps from DGraph on startup if in-memory is empty. If DGraph is also empty, backfill from chain events. */
  private async backfillFromDGraphIfNeeded(): Promise<void> {
    // Check if in-memory has any dApps
    const inMemoryDapps = await dappRepository.findAll(100, 0);
    if (inMemoryDapps.length > 0) {
      logger.debug('In-memory dApps already populated, skipping backfill');
      return;
    }

    let dgraphHasData = false;
    try {
      const axios = require('axios');
      const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
      const query = `
        query dapps($limit: Int, $offset: Int) {
          dapps(limit: $limit, offset: $offset) {
            id
            name
            description
            owner
            permlink
            version
            manifest {
              entryPoint
              assets
              dependencies
              permissions
              pathMap
              metadata {
                title
                description
                author
                version
                license
                thumbnail
              }
            }
            blobIds
            tags
            createdAt
            updatedAt
          }
        }
      `;

      const response = await axios.post(`${DGRAPH_SERVICE_URL}/graphql`, {
        query,
        variables: { limit: 100, offset: 0 }
      }, {
        timeout: 5000,
        validateStatus: () => true
      });

      if (response.status === 200 && !response.data.errors && response.data.data?.dapps) {
        const dapps = response.data.data.dapps || [];
        dgraphHasData = dapps.length > 0;
        
        for (const d of dapps) {
          let manifest = d.manifest || {};
          if (typeof manifest === 'string') {
            try {
              manifest = JSON.parse(manifest);
            } catch {
              manifest = {};
            }
          }

          await dappRepository.save({
            id: d.id,
            name: d.name,
            description: d.description || '',
            owner: d.owner,
            permlink: d.permlink || d.id.split(':').pop() || d.id,
            version: d.version || '1.0.0',
            manifest,
            blobIds: d.blobIds || [],
            tags: d.tags || [],
            createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
            updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date()
          });
        }

        if (dapps.length > 0) {
          logger.info('Backfilled in-memory dApps from DGraph', { count: dapps.length });
        }
      }
    } catch (error) {
      logger.debug('Failed to backfill from DGraph (non-critical)', { error });
    }

    // If DGraph is empty but in-memory is also empty, backfill from chain events
    if (!dgraphHasData) {
      const stillEmpty = await dappRepository.findAll(1, 0);
      if (stillEmpty.length === 0) {
        logger.info('Both DGraph and in-memory are empty, backfilling from chain events');
        try {
          await this.backfillRecentEvents();
          // Verify backfill worked
          const afterBackfill = await dappRepository.findAll(1, 0);
          if (afterBackfill.length === 0) {
            logger.warn('Backfill from chain events returned no dApps - indexer may not be processing events correctly');
          } else {
            logger.info('Backfill from chain events successful', { count: afterBackfill.length });
          }
        } catch (error) {
          logger.error('Failed to backfill from chain events', { error });
        }
      }
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Indexer is already running');
      return;
    }

    const packageId = process.env.SUI_PACKAGE_ID;
    if (!packageId) {
      logger.warn(
        'SUI_PACKAGE_ID not set - indexer disabled. Set to your deployed package ID (e.g. 0x123...) to only process events from your namespace. Without this, we would poll the entire testnet.'
      );
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    await this.clearDappsAndSeedCursorIfRequested();
    // If in-memory is still empty after clear/backfill, try backfilling from DGraph
    await this.backfillFromDGraphIfNeeded();

    const mode = process.env.INDEXER_MODE === 'stream' ? 'stream' : 'poll';
    const modules = this.getModules();

    logger.info('Starting SUI indexer', {
      packageId,
      modules,
      mode
    });

    try {
      if (mode === 'stream') {
        try {
          logger.info('SUI indexer started - streaming events via WebSocket');
          await this.startEventStream();
        } catch (streamErr: unknown) {
          const msg = streamErr instanceof Error ? streamErr.message : String(streamErr);
          const is405 = msg.includes('405') || msg.includes('Unexpected server response');
          if (is405) {
            logger.warn(
              'WebSocket stream not supported by RPC (e.g. 405). Falling back to poll mode. Set INDEXER_MODE=poll to avoid this.'
            );
            await this.startEventSubscription();
          } else {
            throw streamErr;
          }
        }
      } else {
        logger.info('SUI indexer started - polling for events from namespace only');
        await this.startEventSubscription();
      }
    } catch (error) {
      logger.error('Failed to start indexer', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping SUI indexer');
    this.isRunning = false;

    if (this.unsubscribe) {
      await this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Stream events via WebSocket (subscribeEvent).
   * Lower CPU than polling; events arrive as they occur.
   * Subscribes to each module in the package separately.
   */
  private async startEventStream(): Promise<void> {
    const client = suiClient.getClient();
    const packageId = process.env.SUI_PACKAGE_ID!;
    const modules = this.getModules();

    const onMessage = async (event: SuiEvent) => {
      if (!this.isRunning) return;
      try {
        await this.processEvent(event);
        this.eventsProcessed += 1;
        this.lastEventId = event.id?.txDigest
          ? `${event.id.txDigest}:${event.id.eventSeq}`
          : null;
        this.lastPollAt = new Date().toISOString();
      } catch (error) {
        logger.error('Error processing streamed event', { eventId: event.id, error });
      }
    };

    // Subscribe to each module (SUI subscribeEvent only supports one MoveEventModule filter)
    for (const mod of modules) {
      const unsub = await client.subscribeEvent({
        filter: {
          MoveEventModule: {
            package: packageId,
            module: mod
          }
        },
        onMessage,
        signal: this.abortController?.signal
      });
      // Store only the first unsub; all are aborted via abortController
      if (!this.unsubscribe) {
        this.unsubscribe = unsub;
      }
    }
    // Subscriptions run in background; WebSocket keeps connections open until stop()
  }

  private async startEventSubscription(): Promise<void> {
    const pollInterval = parseInt(process.env.POLL_INTERVAL || '30000', 10);

    while (this.isRunning && !this.abortController?.signal.aborted) {
      try {
        await this.pollForUpdates();
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        logger.error('Error during polling', error);
        // Continue polling despite errors
      }
    }
  }

  private async pollForUpdates(): Promise<void> {
    try {
      const events = await this.queryRecentEvents();

      for (const event of events) {
        await this.processEvent(event);
        this.eventsProcessed += 1;
        this.lastEventId = event.id?.txDigest ? `${event.id.txDigest}:${event.id.eventSeq}` : null;
      }

      this.lastPollAt = new Date().toISOString();
    } catch (error) {
      logger.error('Error polling for updates', error);
      throw error;
    }
  }

  /**
   * Query events filtered by our package namespace.
   * Uses MoveEventModule filter - only events from our package are returned.
   * Queries each subscribed module and merges results.
   */
  private async queryRecentEvents(): Promise<SuiEvent[]> {
    const client = suiClient.getClient();
    const packageId = process.env.SUI_PACKAGE_ID;
    const modules = this.getModules();

    if (!packageId) {
      return [];
    }

    const allEvents: SuiEvent[] = [];

    for (const mod of modules) {
      const cursor =
        this.lastEventId && this.lastEventId.includes(':')
          ? { txDigest: this.lastEventId.split(':')[0], eventSeq: this.lastEventId.split(':')[1] }
          : undefined;

      // Retry logic for RPC timeouts (504) - common with 5 modules polling
      let retries = 3;
      let lastError: unknown = null;
      while (retries > 0) {
        try {
          const result = await client.queryEvents({
            query: {
              MoveEventModule: {
                package: packageId,
                module: mod
              }
            },
            limit: 50,
            order: cursor ? 'ascending' : 'descending',
            cursor
          });

          if (result.data) {
            allEvents.push(...result.data);
          }
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          const isTimeout = error?.status === 504 || error?.statusText === 'Gateway Timeout' || 
                           error?.message?.includes('timeout') || error?.message?.includes('504');
          if (isTimeout && retries > 1) {
            const delay = (4 - retries) * 2000; // 2s, 4s, 6s backoff
            logger.warn(`RPC timeout querying ${mod}, retrying in ${delay}ms`, { retriesLeft: retries - 1 });
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
          } else {
            logger.error('Error querying events for module', { module: mod, error, retriesLeft: retries - 1 });
            break; // Non-timeout error or out of retries
          }
        }
      }
    }

    return allEvents;
  }

  private async processEvent(event: SuiEvent): Promise<void> {
    try {
      logger.debug('Processing event', { eventId: event.id, type: event.type });

      // Route events to appropriate processors
      if (this.isTextObjectEvent(event)) {
        await textObjectProcessor.process(event);
      } else if (this.isDAppEvent(event)) {
        await dappProcessor.process(event);
      }

    } catch (error) {
      logger.error('Error processing event', { eventId: event.id, error });
    }
  }

  private isTextObjectEvent(event: SuiEvent): boolean {
    return event.type.includes('text') || event.type.includes('TextObject');
  }

  private isDAppEvent(event: SuiEvent): boolean {
    return (
      event.type.includes('dapp_posting') ||
      event.type.includes('DappPosted') ||
      event.type.includes('PredictionMarketTriggered') ||
      event.type.includes('dapp') ||
      event.type.includes('DApp')
    );
  }

  /**
   * Process events from a specific transaction (e.g. from getTransactionBlock with showEvents).
   * Used by admin backfill-tx to "put the cursor in front of" a tx and ingest it.
   */
  async processEventsFromTx(events: SuiEvent[]): Promise<{ processed: number }> {
    let processed = 0;
    for (const event of events) {
      await this.processEvent(event);
      processed += 1;
      if (event.id?.txDigest) {
        this.lastEventId = `${event.id.txDigest}:${event.id.eventSeq}`;
      }
    }
    return { processed };
  }
}

export const indexer = new SUIIndexer();