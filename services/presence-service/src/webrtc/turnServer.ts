import { TURNConfig } from '@dlux-sui/types';
import { logger } from '../utils/logger';

class TURNManager {
  private config: TURNConfig | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // Configure TURN server
      this.config = {
        urls: [
          `turn:${process.env.TURN_HOST || 'localhost'}:${process.env.TURN_PORT || '3478'}`,
          `stun:${process.env.STUN_HOST || 'localhost'}:${process.env.STUN_PORT || '3478'}`
        ],
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_PASSWORD,
        credentialType: 'password'
      };

      this.isRunning = true;
      logger.info('TURN server configured', { urls: this.config.urls });

    } catch (error) {
      logger.error('Failed to start TURN server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.config = null;
    logger.info('TURN server stopped');
  }

  getConfig(): TURNConfig | null {
    return this.config;
  }

  generateCredentials(): { username: string; password: string } {
    // Generate temporary credentials for WebRTC
    const timestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiry
    const username = `${timestamp}`;
    const password = generatePassword();

    return { username, password };
  }
}

function generatePassword(): string {
  // Generate a secure random password
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex');
}

export const turnServer = new TURNManager();