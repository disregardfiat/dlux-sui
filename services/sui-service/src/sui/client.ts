import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { logger } from '../utils/logger';

class SUIClient {
  private client: SuiClient | null = null;

  async connect(): Promise<void> {
    try {
      const network = process.env.SUI_NETWORK || 'mainnet';
      const url = getFullnodeUrl(network as any);

      this.client = new SuiClient({ url });
      logger.info(`Connected to SUI ${network} network`);
    } catch (error) {
      logger.error('Failed to connect to SUI network', error);
      throw error;
    }
  }

  getClient(): SuiClient {
    if (!this.client) {
      throw new Error('SUI client not initialized');
    }
    return this.client;
  }

  async disconnect(): Promise<void> {
    // SUI client doesn't have a disconnect method, but we can set it to null
    this.client = null;
    logger.info('Disconnected from SUI network');
  }
}

export const suiClient = new SUIClient();