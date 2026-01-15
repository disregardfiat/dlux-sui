import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { ZKLoginRequest, ZKLinkRequest, AuthChallenge, AuthToken, ZKProvider } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { authService } from '../services/authService';

const router = express.Router();

// Generate challenge for ZK login
router.post('/challenge', async (req, res) => {
  try {
    const { suiAddress } = req.body;

    if (!suiAddress) {
      return res.status(400).json({ error: 'SUI address is required' });
    }

    const challenge = await authService.generateChallenge(suiAddress);

    res.json({
      challengeId: challenge.id,
      challenge: challenge.challenge,
      expiresAt: challenge.expiresAt
    });

  } catch (error) {
    logger.error('Error generating challenge', error);
    res.status(500).json({ error: 'Failed to generate challenge' });
  }
});

// ZK Login with SUI signature
router.post('/zk-login', async (req, res) => {
  try {
    const { suiAddress, signature, challengeId, challenge, proof, provider }: ZKLoginRequest & { challengeId?: string; challenge?: string } = req.body;

    if (!suiAddress || signature === undefined || signature === null) {
      return res.status(400).json({ error: 'SUI address and signature are required' });
    }

    // Verify challenge if provided
    if (challengeId) {
      const isValidChallenge = await authService.verifyChallenge(challengeId, suiAddress);
      if (!isValidChallenge) {
        return res.status(401).json({ error: 'Invalid or expired challenge' });
      }
    }

    // Verify SUI signature and ZK proof
    const isValid = await authService.verifyZKLogin(suiAddress, signature, proof, provider);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature or proof' });
    }

    // Generate JWT token
    const token = await authService.generateToken(suiAddress);

    res.json({
      token: token.token,
      expiresAt: token.expiresAt,
      user: { suiAddress }
    });

  } catch (error) {
    logger.error('Error during ZK login', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Link ZK proof from external provider
router.post('/zk-link', async (req, res) => {
  try {
    const { suiAddress, provider, challengeId, proof }: ZKLinkRequest = req.body;

    if (!suiAddress || !provider || !challengeId || !proof) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Verify the challenge and link ZK proof
    const linked = await authService.linkZKProof(suiAddress, provider, challengeId, proof);

    if (!linked) {
      return res.status(400).json({ error: 'Failed to link ZK proof' });
    }

    res.json({ success: true, message: 'ZK proof linked successfully' });

  } catch (error) {
    logger.error('Error linking ZK proof', error);
    res.status(500).json({ error: 'Failed to link ZK proof' });
  }
});

// Get user profile with linked ZKs
router.get('/profile/:suiAddress', async (req, res) => {
  try {
    const { suiAddress } = req.params;

    const user = await authService.getUserProfile(suiAddress);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);

  } catch (error) {
    logger.error('Error getting user profile', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Verify JWT token
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = await authService.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json(decoded);

  } catch (error) {
    logger.error('Error verifying token', error);
    res.status(500).json({ error: 'Token verification failed' });
  }
});

export { router as authRouter };