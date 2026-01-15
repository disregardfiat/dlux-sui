import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User, ZKLink, AuthChallenge, AuthToken, ZKProvider } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { suiClient } from '../sui/client';

// In-memory storage - replace with Redis/database in production
const users = new Map<string, User>();
const challenges = new Map<string, AuthChallenge>();
const tokens = new Map<string, AuthToken>();

class AuthService {
  private jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  private challengeExpiry = 5 * 60 * 1000; // 5 minutes
  private tokenExpiry = 24 * 60 * 60 * 1000; // 24 hours

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
    proof?: string,
    provider?: ZKProvider
  ): Promise<boolean> {
    try {
      // TODO: Implement proper ZK verification
      // For now, just verify the SUI signature

      const isValidSignature = await this.verifySUISignature(suiAddress, signature);

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
  ): Promise<boolean> {
    try {
      // Verify challenge exists and hasn't expired
      const challenge = challenges.get(challengeId);
      if (!challenge || challenge.expiresAt < new Date() || challenge.suiAddress !== suiAddress) {
        logger.warn('Invalid or expired challenge', { challengeId, suiAddress });
        return false;
      }

      // TODO: Verify ZK proof from external provider
      const isValidProof = await this.verifyZKProof(provider, proof, challenge.challenge);

      if (!isValidProof) {
        logger.warn('Invalid ZK proof', { provider, suiAddress });
        return false;
      }

      // Get or create user
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

      // Add ZK link
      const zkLink: ZKLink = {
        provider,
        proof: await bcrypt.hash(proof, 10), // Hash the proof for storage
        linkedAt: new Date()
      };

      user.linkedZKPs.push(zkLink);
      user.updatedAt = new Date();

      // Remove used challenge
      challenges.delete(challengeId);

      logger.info('ZK proof linked successfully', { suiAddress, provider });
      return true;

    } catch (error) {
      logger.error('ZK proof linking failed', { suiAddress, provider, error });
      return false;
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

    tokens.set(token, authToken);

    logger.debug('Generated JWT token', { suiAddress });
    return authToken;
  }

  async verifyToken(token: string): Promise<any | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);

      // Check if token exists in our store
      const storedToken = tokens.get(token);
      if (!storedToken || storedToken.expiresAt < new Date()) {
        return null;
      }

      return decoded;
    } catch (error) {
      logger.debug('Token verification failed', { error });
      return null;
    }
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

  private async verifySUISignature(suiAddress: string, signature: string): Promise<boolean> {
    try {
      // TODO: Implement proper SUI signature verification
      // For now, just check if signature exists
      return !!(signature && signature.length > 0);
    } catch (error) {
      logger.error('SUI signature verification failed', { suiAddress, error });
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