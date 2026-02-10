import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

interface SealObject {
  objectId: string;
  owner: string;
  encryptedData: string;
  sealPackage: any; // Sui Seal package object
}

interface SealAccessGrant {
  objectId: string;
  grantee: string;
  grantId: string;
  expiration?: Date;
}

export class SealClient {
  private client: AxiosInstance | null = null;
  private baseUrl = process.env.SEAL_BASE_URL || 'https://seal-testnet.sui.io';

  async connect(): Promise<void> {
    try {
      this.client = axios.create({
        baseURL: this.baseUrl,
        timeout: 5000, // 5 seconds - fail fast
      });

      // Test connection
      await this.client.get('/health');
      logger.info(`Connected to Seal at ${this.baseUrl}`);
    } catch (error) {
      // Don't throw - allow service to run without Seal
      logger.warn('Failed to connect to Seal - premium encryption disabled', error instanceof Error ? error.message : String(error));
      this.client = null; // Ensure client is null so getClient() returns mock
    }
  }

  getClient(): AxiosInstance {
    if (!this.client) {
      // Return a mock client that fails gracefully for test mode
      logger.warn('Seal client not initialized - using mock client');
      return axios.create({
        baseURL: 'http://localhost',
        timeout: 1000,
      });
    }
    return this.client;
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async disconnect(): Promise<void> {
    this.client = null;
    logger.info('Disconnected from Seal');
  }

  /**
   * Encrypt content with Seal for premium access
   */
  async encryptContent(data: Buffer, owner: string): Promise<SealObject> {
    const client = this.getClient();

    try {
      const response = await client.post('/encrypt', {
        data: data.toString('base64'),
        owner,
        metadata: {
          contentType: 'application/octet-stream',
          encryptedAt: new Date().toISOString()
        }
      });

      return {
        objectId: response.data.objectId,
        owner,
        encryptedData: response.data.encryptedData,
        sealPackage: response.data.sealPackage
      };
    } catch (error) {
      logger.error('Failed to encrypt content with Seal', error);
      throw error;
    }
  }

  /**
   * Grant access to encrypted content
   */
  async grantAccess(
    objectId: string,
    grantee: string,
    expiration?: Date
  ): Promise<SealAccessGrant> {
    const client = this.getClient();

    try {
      const response = await client.post(`/objects/${objectId}/grant`, {
        grantee,
        expiration: expiration?.toISOString()
      });

      return {
        objectId,
        grantee,
        grantId: response.data.grantId,
        expiration
      };
    } catch (error) {
      logger.error('Failed to grant Seal access', { objectId, grantee, error });
      throw error;
    }
  }

  /**
   * Revoke access to encrypted content
   */
  async revokeAccess(objectId: string, grantee: string): Promise<void> {
    const client = this.getClient();

    try {
      await client.delete(`/objects/${objectId}/grant/${grantee}`);
      logger.info('Seal access revoked', { objectId, grantee });
    } catch (error) {
      logger.error('Failed to revoke Seal access', { objectId, grantee, error });
      throw error;
    }
  }

  /**
   * Check if user has access to encrypted content
   */
  async checkAccess(objectId: string, user: string): Promise<boolean> {
    const client = this.getClient();

    try {
      const response = await client.get(`/objects/${objectId}/access/${user}`);
      return response.data.hasAccess === true;
    } catch (error) {
      logger.error('Failed to check Seal access', { objectId, user, error });
      return false;
    }
  }

  /**
   * Decrypt content for authorized user
   */
  async decryptContent(objectId: string, user: string): Promise<Buffer> {
    const client = this.getClient();

    try {
      const response = await client.post(`/objects/${objectId}/decrypt`, {
        user
      });

      return Buffer.from(response.data.decryptedData, 'base64');
    } catch (error) {
      logger.error('Failed to decrypt Seal content', { objectId, user, error });
      throw error;
    }
  }

  /**
   * Get Seal object metadata
   */
  async getObjectInfo(objectId: string): Promise<SealObject> {
    const client = this.getClient();

    try {
      const response = await client.get(`/objects/${objectId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Seal object info', { objectId, error });
      throw error;
    }
  }
}

export const sealClient = new SealClient();