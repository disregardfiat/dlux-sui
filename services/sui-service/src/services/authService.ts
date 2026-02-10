import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { User, ZKLink, AuthChallenge, AuthToken, ZKProvider } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { suiClient } from '../sui/client';

// In-memory storage for challenges (short-lived, 5-min TTL — acceptable for single-replica).
// For multi-replica deployments, swap to Redis.
const users = new Map<string, User>();
const challenges = new Map<string, AuthChallenge>();

class AuthService {
  private jwtSecret: string;
  private challengeExpiry = 5 * 60 * 1000; // 5 minutes
  private tokenExpiry = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || '';
    if (!this.jwtSecret) {
      const fallback = crypto.randomBytes(32).toString('hex');
      logger.warn(
        'JWT_SECRET not set! Using a random secret. Tokens will NOT survive restarts. Set JWT_SECRET in production.'
      );
      this.jwtSecret = fallback;
    }
  }

  async generateChallenge(suiAddress: string): Promise<AuthChallenge> {
    const challengeId = crypto.randomUUID();
    const challenge = crypto.randomBytes(32).toString('hex');

    const authChallenge: AuthChallenge = {
      id: challengeId,
      suiAddress,
      challenge,
      expiresAt: new Date(Date.now() + this.challengeExpiry)
    };

    challenges.set(challengeId, authChallenge);

    // Clean up expired challenges
    this.cleanupExpiredChallenges();

    logger.info('Generated auth challenge', { challengeId, suiAddress });

    return authChallenge;
  }

  async verifyZKLogin(
    suiAddress: string,
    signature: string,
    challengeId: string,
    proof?: string,
    provider?: ZKProvider
  ): Promise<boolean> {
    try {
      // Look up the original challenge message so we can verify the signature
      const challenge = challenges.get(challengeId);
      if (!challenge || challenge.suiAddress !== suiAddress) {
        logger.warn('Challenge not found or address mismatch for signature verification', { suiAddress, challengeId });
        return false;
      }

      const isValidSignature = await this.verifySUISignature(suiAddress, signature, challenge.challenge);

      if (!isValidSignature) {
        logger.warn('Invalid SUI signature', { suiAddress });
        return false;
      }

      // Create or update user
      let user = users.get(suiAddress);
      if (!user) {
        user = {
          suiAddress,
          linkedZKPs: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        users.set(suiAddress, user);
      }

      user.updatedAt = new Date();

      logger.info('ZK login successful', { suiAddress, provider });
      return true;

    } catch (error) {
      logger.error('ZK login verification failed', { suiAddress, error });
      return false;
    }
  }

  async linkZKProof(
    suiAddress: string,
    provider: ZKProvider,
    challengeId: string,
    proof: string
  ): Promise<{ transactionId: string }> {
    try {
      // Verify challenge exists and hasn't expired
      const challenge = challenges.get(challengeId);
      if (!challenge || challenge.expiresAt < new Date() || challenge.suiAddress !== suiAddress) {
        throw new Error('Invalid or expired challenge');
      }

      // TODO: Verify ZK proof from external provider
      const isValidProof = await this.verifyZKProof(provider, proof, challenge.challenge);

      if (!isValidProof) {
        throw new Error('Invalid ZK proof');
      }

      // TODO: Create and submit SUI transaction for ZK proof linkage

      // Mock SUI transaction - replace with actual blockchain interaction
      const transactionId = `zk_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Remove used challenge
      challenges.delete(challengeId);

      // Update user profile in memory (test-friendly)
      let user = users.get(suiAddress);
      if (!user) {
        user = {
          suiAddress,
          linkedZKPs: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        users.set(suiAddress, user);
      }

      const alreadyLinked = user.linkedZKPs.some(
        (link) => link.provider === provider && link.proof === proof
      );
      if (!alreadyLinked) {
        const zkLink: ZKLink = {
          provider,
          proof,
          linkedAt: new Date()
        };
        user.linkedZKPs.push(zkLink);
      }
      user.updatedAt = new Date();

      logger.info('ZK proof linkage transaction submitted', {
        suiAddress,
        provider,
        transactionId
      });

      // Note: Actual persistence will happen via blockchain indexer
      // when the transaction is confirmed

      return { transactionId };

    } catch (error) {
      logger.error('ZK proof linking failed', { suiAddress, provider, error });
      throw error;
    }
  }

  async generateToken(suiAddress: string): Promise<AuthToken> {
    const payload = {
      suiAddress,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + this.tokenExpiry) / 1000)
    };

    const token = jwt.sign(payload, this.jwtSecret);

    const authToken: AuthToken = {
      userId: suiAddress,
      suiAddress,
      token,
      expiresAt: new Date(Date.now() + this.tokenExpiry)
    };

    // JWT is self-verifying — no need to store tokens in memory.
    // The token encodes its own expiry and is signed with jwtSecret.

    logger.debug('Generated JWT token', { suiAddress });
    return authToken;
  }

  async verifyToken(token: string): Promise<any | null> {
    try {
      // JWT is self-verifying via the secret — no need for an in-memory token store.
      // This allows the service to work across multiple replicas and survive restarts.
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      logger.debug('Token verification failed', { error });
      return null;
    }
  }

  async verifySignature(suiAddress: string, signature: string, challengeText: string): Promise<boolean> {
    return this.verifySUISignature(suiAddress, signature, challengeText);
  }

  async getUserProfile(suiAddress: string): Promise<User | null> {
    return users.get(suiAddress) || null;
  }

  async verifyChallenge(challengeId: string, suiAddress: string): Promise<boolean> {
    const challenge = challenges.get(challengeId);
    if (!challenge) {
      return false;
    }
    if (challenge.expiresAt < new Date()) {
      challenges.delete(challengeId);
      return false;
    }
    if (challenge.suiAddress !== suiAddress) {
      return false;
    }
    // Challenge is valid, but don't delete it yet (might be used for ZK linking)
    return true;
  }

  consumeChallenge(challengeId: string): void {
    challenges.delete(challengeId);
  }

  /** Get the challenge text for a given challengeId (for signature verification). */
  getChallengeText(challengeId: string): string | null {
    const challenge = challenges.get(challengeId);
    return challenge?.challenge ?? null;
  }

  /**
   * Verify a SUI personal message signature against the original challenge text.
   * Uses @mysten/sui/verify to recover the public key from the signature and
   * checks that the derived address matches the claimed suiAddress.
   */
  private async verifySUISignature(suiAddress: string, signature: string, challengeText: string): Promise<boolean> {
    try {
      if (!signature || !challengeText) return false;

      const message = new TextEncoder().encode(challengeText);

      // verifyPersonalMessageSignature recovers the public key from the signature.
      // Passing `address` makes it throw if the recovered key doesn't match.
      await verifyPersonalMessageSignature(message, signature, {
        address: suiAddress,
      });

      logger.debug('SUI signature verified', { suiAddress });
      return true;
    } catch (error) {
      logger.error('SUI signature verification failed', { suiAddress, error: error instanceof Error ? error.message : error });
      return false;
    }
  }

  private async verifyZKProof(provider: ZKProvider, proof: string, challenge: string): Promise<boolean> {
    try {
      // TODO: Implement ZK proof verification for each provider
      // This would involve verifying OAuth tokens, GitHub proofs, etc.
      // For now, just check if proof exists and matches expected format

      switch (provider) {
        case 'github':
          return this.verifyGitHubProof(proof, challenge);
        case 'gmail':
          return this.verifyGmailProof(proof, challenge);
        case 'facebook':
          return this.verifyFacebookProof(proof, challenge);
        default:
          return false;
      }
    } catch (error) {
      logger.error('ZK proof verification failed', { provider, error });
      return false;
    }
  }

  private async verifyGitHubProof(proof: string, challenge: string): Promise<boolean> {
    // TODO: Verify GitHub OAuth token and check if challenge was signed
    return !!(proof && proof.length > 0);
  }

  private async verifyGmailProof(proof: string, challenge: string): Promise<boolean> {
    // TODO: Verify Gmail OAuth token and check if challenge was signed
    return !!(proof && proof.length > 0);
  }

  private async verifyFacebookProof(proof: string, challenge: string): Promise<boolean> {
    // TODO: Verify Facebook OAuth token and check if challenge was signed
    return !!(proof && proof.length > 0);
  }

  private cleanupExpiredChallenges(): void {
    const now = new Date();
    for (const [id, challenge] of challenges.entries()) {
      if (challenge.expiresAt < now) {
        challenges.delete(id);
      }
    }
  }
}

export const authService = new AuthService();