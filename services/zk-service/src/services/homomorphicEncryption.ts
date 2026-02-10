import { generateRandomKeys, PublicKey, PrivateKey } from 'paillier-bigint';
import { logger } from '../utils/logger';

/**
 * Homomorphic encryption service for privacy-preserving aggregate statistics
 * Uses Paillier cryptosystem for additive homomorphic operations
 */
export class HomomorphicEncryption {
  private publicKey: PublicKey | null = null;
  private privateKey: PrivateKey | null = null;

  /**
   * Initialize encryption keys from environment or generate new ones
   */
  async initialize(): Promise<void> {
    const publicKeyB64 = process.env.HOMOMORPHIC_PUBLIC_KEY;
    const privateKeyB64 = process.env.HOMOMORPHIC_PRIVATE_KEY;

    if (publicKeyB64 && privateKeyB64) {
      // Load keys from environment (base64 encoded JSON)
      try {
        const publicKeyJson = JSON.parse(Buffer.from(publicKeyB64, 'base64').toString());
        const privateKeyJson = JSON.parse(Buffer.from(privateKeyB64, 'base64').toString());
        
        this.publicKey = new PublicKey(
          BigInt(publicKeyJson.n),
          BigInt(publicKeyJson.g)
        );
        
        this.privateKey = new PrivateKey(
          BigInt(privateKeyJson.lambda),
          BigInt(privateKeyJson.mu),
          this.publicKey
        );
        
        logger.info('Homomorphic encryption keys loaded from environment');
      } catch (error) {
        logger.error('Failed to load encryption keys from environment', error);
        await this.generateKeys();
      }
    } else {
      // Generate new keys
      await this.generateKeys();
    }
  }

  /**
   * Generate new encryption key pair
   */
  async generateKeys(): Promise<{ publicKey: string; privateKey: string }> {
    logger.info('Generating new homomorphic encryption keys...');
    const { publicKey, privateKey } = await generateRandomKeys(3072); // 3072-bit keys for security
    
    this.publicKey = publicKey;
    this.privateKey = privateKey;

    // Serialize keys to base64 for storage
    const publicKeyJson = {
      n: publicKey.n.toString(),
      g: publicKey.g.toString()
    };
    
    const privateKeyJson = {
      lambda: privateKey.lambda.toString(),
      mu: privateKey.mu.toString(),
      n: publicKey.n.toString(),
      g: publicKey.g.toString()
    };

    const publicKeyB64 = Buffer.from(JSON.stringify(publicKeyJson)).toString('base64');
    const privateKeyB64 = Buffer.from(JSON.stringify(privateKeyJson)).toString('base64');

    logger.info('Encryption keys generated. Add to environment:');
    logger.info(`HOMOMORPHIC_PUBLIC_KEY=${publicKeyB64}`);
    logger.info(`HOMOMORPHIC_PRIVATE_KEY=${privateKeyB64}`);

    return { publicKey: publicKeyB64, privateKey: privateKeyB64 };
  }

  /**
   * Get public key for encryption (can be shared)
   */
  getPublicKey(): PublicKey {
    if (!this.publicKey) {
      throw new Error('Encryption keys not initialized');
    }
    return this.publicKey;
  }

  /**
   * Encrypt an impression count (encrypts 1 for a single impression)
   * @param adId Ad identifier
   * @param contentId Content identifier
   * @returns Encrypted value as base64 string
   */
  encryptImpression(adId: string, contentId: string): string {
    if (!this.publicKey) {
      throw new Error('Encryption keys not initialized');
    }

    // Encrypt 1 (one impression)
    const encrypted = this.publicKey.encrypt(1n);
    return encrypted.toString();
  }

  /**
   * Aggregate encrypted impressions (homomorphic addition)
   * Can compute sum without decrypting individual values
   * @param encryptedImpressions Array of encrypted values (base64 strings)
   * @returns Encrypted aggregate as string
   */
  aggregateImpressions(encryptedImpressions: string[]): string {
    if (!this.publicKey) {
      throw new Error('Encryption keys not initialized');
    }

    if (encryptedImpressions.length === 0) {
      // Return encrypted zero
      return this.publicKey.encrypt(0n).toString();
    }

    let aggregate = BigInt(encryptedImpressions[0]);

    for (let i = 1; i < encryptedImpressions.length; i++) {
      const encryptedBigInt = BigInt(encryptedImpressions[i]);
      // Homomorphic addition: E(a) * E(b) = E(a + b)
      aggregate = this.publicKey.addition(aggregate, encryptedBigInt);
    }

    return aggregate.toString();
  }

  /**
   * Decrypt aggregate (only foundation/admin can decrypt)
   * @param encryptedAggregate Encrypted aggregate value
   * @returns Decrypted count as number
   */
  decryptAggregate(encryptedAggregate: string): number {
    if (!this.privateKey) {
      throw new Error('Private key not available (admin only)');
    }

    const decrypted = this.privateKey.decrypt(BigInt(encryptedAggregate));
    return Number(decrypted);
  }

  /**
   * Encrypt viewer identity for storage (homomorphic encryption)
   * Note: This is for aggregate statistics only, individual identities remain private
   * @param viewerIdentity SuiNS name or address
   * @returns Encrypted identity as string
   */
  encryptViewerIdentity(viewerIdentity: string): string {
    if (!this.publicKey) {
      throw new Error('Encryption keys not initialized');
    }

    // Hash identity to fixed-size value for encryption
    const identityHash = this.hashIdentity(viewerIdentity);
    const encrypted = this.publicKey.encrypt(BigInt(identityHash));
    return encrypted.toString();
  }

  /**
   * Hash identity to fixed-size value (for encryption)
   */
  private hashIdentity(identity: string): string {
    // Simple hash function (in production, use crypto.createHash)
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(identity).digest('hex');
    // Convert to number (first 16 hex chars)
    return hash.substring(0, 16);
  }
}

export const homomorphicEncryption = new HomomorphicEncryption();
