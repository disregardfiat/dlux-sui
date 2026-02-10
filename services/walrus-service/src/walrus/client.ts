import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

/** Official Walrus publishers (docs.wal.app). */
const WALRUS_PUBLISHER_TESTNET = 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_PUBLISHER_MAINNET = 'https://walrus-mainnet.mrgnlabs.xyz';

class WalrusClient {
  private client: AxiosInstance | null = null;
  private baseUrl: string;
  
  constructor() {
    // Use env var if set, otherwise infer from network
    if (process.env.WALRUS_BASE_URL) {
      this.baseUrl = process.env.WALRUS_BASE_URL;
    } else {
      // Infer network from SUI_NETWORK env var or default to testnet
      const network = process.env.SUI_NETWORK || 'testnet';
      this.baseUrl = network === 'mainnet' ? WALRUS_PUBLISHER_MAINNET : WALRUS_PUBLISHER_TESTNET;
    }
  }

  async connect(): Promise<void> {
    try {
      this.client = axios.create({
        baseURL: this.baseUrl,
        timeout: 15000,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      await this.client.get('/v1/api');
      logger.info(`Connected to Walrus at ${this.baseUrl}`);
    } catch (error) {
      logger.warn('Failed to connect to Walrus', error instanceof Error ? error.message : String(error));
      this.client = null;
    }
  }

  getClient(): AxiosInstance {
    if (!this.client) {
      throw new Error('Walrus client not initialized');
    }
    return this.client;
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async disconnect(): Promise<void> {
    this.client = null;
    logger.info('Disconnected from Walrus');
  }

  /** Extract blobId from BlobStoreResult (newlyCreated or alreadyCertified). */
  private blobIdFromResult(data: any): string | null {
    if (!data) return null;
    // Try various response formats
    if (data.newlyCreated?.blobObject?.blobId) return data.newlyCreated.blobObject.blobId;
    if (data.alreadyCertified?.blob_id) return data.alreadyCertified.blob_id;
    if (data.alreadyCertified?.blobId) return data.alreadyCertified.blobId;
    if (data.blobId) return data.blobId;
    if (data.id) return data.id;
    if (data.blob_id) return data.blob_id;
    const ac = data.alreadyCertified;
    if (ac && typeof ac === 'object' && ac.blob_id) return ac.blob_id;
    if (ac && typeof ac === 'object' && ac.blobId) return ac.blobId;
    // Check nested structures
    if (data.blobObject?.blobId) return data.blobObject.blobId;
    if (data.blobObject?.blob_id) return data.blobObject.blob_id;
    return null;
  }

  async storeBlob(data: Buffer, epochs?: number): Promise<string> {
    const client = this.getClient();
    const params = epochs ? { epochs } : {};
    try {
      const response = await client.put('/v1/blobs', data, { params });
      logger.debug('Walrus PUT response', { 
        status: response.status, 
        data: response.data,
        headers: response.headers 
      });
      const blobId = this.blobIdFromResult(response.data);
      if (blobId) {
        logger.info('Blob stored to Walrus', { blobId, size: data.length });
        return blobId;
      }
      logger.error('Invalid Walrus response format', { 
        responseData: response.data,
        status: response.status 
      });
      throw new Error(`Invalid response from Walrus: no blobId. Response: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      logger.error('Failed to store blob to Walrus', {
        error: error.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        responseData: error?.response?.data
      });
      throw error;
    }
  }

  async getBlob(blobId: string): Promise<Buffer> {
    const client = this.getClient();
    const response = await client.get(`/v1/blobs/${blobId}`, {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  }

  async getBlobInfo(blobId: string): Promise<any> {
    const client = this.getClient();
    const response = await client.get(`/v1/blobs/${blobId}/info`);
    return response.data;
  }
}

export const walrusClient = new WalrusClient();
