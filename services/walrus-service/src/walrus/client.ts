import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

class WalrusClient {
  private client: AxiosInstance | null = null;
  private baseUrl = process.env.WALRUS_BASE_URL || 'https://walrus-testnet.mrgnlabs.xyz';

  async connect(): Promise<void> {
    try {
      this.client = axios.create({
        baseURL: this.baseUrl,
        timeout: 30000, // 30 seconds
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });

      // Test connection
      await this.client.get('/v1/info');
      logger.info(`Connected to Walrus at ${this.baseUrl}`);
    } catch (error) {
      logger.error('Failed to connect to Walrus', error);
      throw error;
    }
  }

  getClient(): AxiosInstance {
    if (!this.client) {
      throw new Error('Walrus client not initialized');
    }
    return this.client;
  }

  async disconnect(): Promise<void> {
    // Axios doesn't have a disconnect method, but we can set it to null
    this.client = null;
    logger.info('Disconnected from Walrus');
  }

  async storeBlob(data: Buffer, epochs?: number): Promise<string> {
    const client = this.getClient();

    try {
      const params = epochs ? { epochs } : {};
      const response = await client.put('/v1/blobs', data, { params });

      if (response.data && response.data.blobId) {
        return response.data.blobId;
      }

      throw new Error('Invalid response from Walrus');
    } catch (error) {
      logger.error('Failed to store blob', error);
      throw error;
    }
  }

  async getBlob(blobId: string): Promise<Buffer> {
    const client = this.getClient();

    try {
      const response = await client.get(`/v1/blobs/${blobId}`, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to get blob', { blobId, error });
      throw error;
    }
  }

  async getBlobInfo(blobId: string): Promise<any> {
    const client = this.getClient();

    try {
      const response = await client.get(`/v1/blobs/${blobId}/info`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get blob info', { blobId, error });
      throw error;
    }
  }
}

export const walrusClient = new WalrusClient();