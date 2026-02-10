import axios from 'axios';
import { logger } from '../utils/logger';

export interface WalrusBlob {
  id: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  url: string;
}

/**
 * Walrus Service for decentralized blob storage and broadcasting
 *
 * Used for:
 * - Broadcasting social blocks to the ecosystem
 * - Storing large media files
 * - Cross-ecosystem data sharing
 */
export class WalrusService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.WALRUS_BASE_URL || 'https://walrus-testnet.mrgnlabs.xyz';
  }

  /**
   * Upload blob to Walrus
   */
  async uploadBlob(
    data: Buffer,
    contentType: string,
    filename?: string
  ): Promise<string> {
    try {
      const formData = new FormData();
      // Convert Buffer to Uint8Array by copying the data to avoid SharedArrayBuffer issues
      const uint8Array = Uint8Array.from(data);
      const blob = new Blob([uint8Array], { type: contentType });
      formData.append('file', blob, filename);

      const response = await axios.post(`${this.baseUrl}/v1/blobs`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const blobId = response.data.blobId || response.data.id;
      logger.info('Blob uploaded to Walrus', { blobId, size: data.length, contentType });

      return blobId;
    } catch (error) {
      logger.error('Failed to upload blob to Walrus', error);
      throw new Error('Walrus upload failed');
    }
  }

  /**
   * Download blob from Walrus
   */
  async downloadBlob(blobId: string): Promise<Buffer> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/blobs/${blobId}`, {
        responseType: 'arraybuffer',
      });

      logger.debug('Blob downloaded from Walrus', { blobId, size: response.data.length });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download blob from Walrus', { blobId, error });
      throw new Error('Walrus download failed');
    }
  }

  /**
   * Get blob metadata
   */
  async getBlobInfo(blobId: string): Promise<WalrusBlob | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/blobs/${blobId}/info`);

      return {
        id: blobId,
        size: response.data.size,
        contentType: response.data.contentType,
        uploadedAt: new Date(response.data.uploadedAt),
        url: `${this.baseUrl}/v1/blobs/${blobId}`
      };
    } catch (error) {
      logger.error('Failed to get blob info from Walrus', { blobId, error });
      return null;
    }
  }

  /**
   * Broadcast data to ecosystem peers
   */
  async broadcastToEcosystem(
    blobId: string,
    dataType: 'social-block' | 'dapp-data' | 'governance-update',
    metadata: any = {}
  ): Promise<void> {
    try {
      // In a real implementation, this would:
      // 1. Discover active ecosystem peers
      // 2. Send blobId and metadata to each peer
      // 3. Peers would then download and verify the data

      const broadcastData = {
        blobId,
        dataType,
        metadata,
        timestamp: new Date().toISOString(),
        sourceEcosystem: 'dlux-sui'
      };

      logger.info('Broadcasting to ecosystem', broadcastData);

      // TODO: Implement actual peer discovery and broadcasting
      // For now, this is a placeholder

    } catch (error) {
      logger.error('Failed to broadcast to ecosystem', error);
    }
  }

  /**
   * Verify data integrity using Walrus
   */
  async verifyDataIntegrity(blobId: string, expectedHash: string): Promise<boolean> {
    try {
      const data = await this.downloadBlob(blobId);
      const actualHash = this.calculateHash(data);

      return actualHash === expectedHash;
    } catch (error) {
      logger.error('Failed to verify data integrity', { blobId, error });
      return false;
    }
  }

  /**
   * Calculate SHA-256 hash of data
   */
  private calculateHash(data: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export const walrusService = new WalrusService();