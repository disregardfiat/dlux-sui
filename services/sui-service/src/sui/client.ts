import { getFullnodeUrl, SuiClient, SuiHTTPTransport } from '@mysten/sui/client';
import { WebSocket } from 'ws';
import { logger } from '../utils/logger';

class SUIClient {
  private client: SuiClient | null = null;

  async connect(): Promise<void> {
    try {
      const network = process.env.SUI_NETWORK || 'mainnet';
      const rpcUrl =
        process.env.SUI_RPC_URL || getFullnodeUrl(network as 'mainnet' | 'testnet' | 'devnet' | 'localnet');

      // Use transport with WebSocket support for subscribeEvent (Node.js needs ws package)
      const transport = new SuiHTTPTransport({
        url: rpcUrl,
        WebSocketConstructor: WebSocket as never
      });

      this.client = new SuiClient({ transport });
      logger.info(`Connected to SUI ${network} network`, { rpcUrl });
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