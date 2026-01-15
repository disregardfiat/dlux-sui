import { SuiEvent } from '@mysten/sui/client';
import { logger } from '../utils/logger';
import { suiClient } from './client';
import { textObjectProcessor } from './processors/textObjectProcessor';
import { dappProcessor } from './processors/dappProcessor';

class SUIIndexer {
  private isRunning = false;
  private abortController: AbortController | null = null;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Indexer is already running');
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    logger.info('Starting SUI indexer');

    try {
      await this.startEventSubscription();
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

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async startEventSubscription(): Promise<void> {
    const client = suiClient.getClient();

    // Subscribe to events from our package (when deployed)
    // For now, we'll poll for new objects periodically
    const pollInterval = parseInt(process.env.POLL_INTERVAL || '30000'); // 30 seconds

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
      // Get latest checkpoint
      const checkpoint = await this.getLatestCheckpoint();

      // Query for new events since last checkpoint
      const events = await this.queryRecentEvents(checkpoint);

      // Process events
      for (const event of events) {
        await this.processEvent(event);
      }

      // Update checkpoint
      if (events.length > 0) {
        await this.updateLatestCheckpoint(events[events.length - 1]);
      }

    } catch (error) {
      logger.error('Error polling for updates', error);
      throw error;
    }
  }

  private async queryRecentEvents(sinceCheckpoint?: string): Promise<SuiEvent[]> {
    const client = suiClient.getClient();

    // This is a simplified implementation
    // In a real implementation, you'd query for events from specific packages
    // and filter for text objects and dApp registrations

    try {
      // Get recent transactions
      const transactions = await client.queryTransactionBlocks({
        limit: 10,
        order: 'descending'
      });

      const events: SuiEvent[] = [];

      for (const tx of transactions.data) {
        if (tx.events && tx.events.length > 0) {
          events.push(...tx.events);
        }
      }

      return events;
    } catch (error) {
      logger.error('Error querying events', error);
      return [];
    }
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
    // TODO: Implement logic to identify text object events
    return event.type.includes('text') || event.type.includes('TextObject');
  }

  private isDAppEvent(event: SuiEvent): boolean {
    // TODO: Implement logic to identify dApp events
    return event.type.includes('dapp') || event.type.includes('DApp');
  }

  private async getLatestCheckpoint(): Promise<string | undefined> {
    // TODO: Implement checkpoint persistence (Redis/database)
    return undefined;
  }

  private async updateLatestCheckpoint(event: SuiEvent): Promise<void> {
    // TODO: Implement checkpoint persistence
    logger.debug('Would update checkpoint', { eventId: event.id });
  }
}

export const indexer = new SUIIndexer();