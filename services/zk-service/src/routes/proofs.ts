import express from 'express';
import { proofGenerator } from '../services/proofGenerator';
import { homomorphicEncryption } from '../services/homomorphicEncryption';
import { logger } from '../utils/logger';

const router = express.Router();

async function handleGenerateProof(
  req: express.Request,
  res: express.Response,
  defaultAction: 'view' | 'click' | 'conversion' = 'view'
) {
  try {
    const {
      adId,
      viewerIdentity,
      contentId,
      blockHeader,
      secretSalt,
      merkleRoot = '0',
      threshold = 100,
      actionType = defaultAction
    } = req.body;

    if (!adId || !viewerIdentity || !contentId || !blockHeader || !secretSalt) {
      return res.status(400).json({
        error: 'Missing required fields: adId, viewerIdentity, contentId, blockHeader, secretSalt'
      });
    }

    // Generate ZK proof (viewer identity is used but NOT included in proof)
    const { proof, publicSignals, proofHash } = await proofGenerator.generateAdViewProof(
      adId,
      viewerIdentity,
      contentId,
      blockHeader,
      secretSalt,
      merkleRoot,
      threshold,
      actionType
    );

    // Encrypt viewer identity (homomorphic) for aggregate statistics
    const encryptedViewer = homomorphicEncryption.encryptViewerIdentity(viewerIdentity);

    res.json({
      proof,
      publicSignals,
      proofHash,
      encryptedViewer // For aggregate statistics (can be decrypted only by admin)
    });
  } catch (error) {
    logger.error('Error generating ZK proof', error);
    res.status(500).json({
      error: 'Failed to generate ZK proof',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * POST /proofs/generate
 * Generate ZK proof for ad view
 * Body: {
 *   adId: string;
 *   viewerIdentity: string; // SuiNS name or address (used but NOT in proof)
 *   contentId: string;
 *   blockHeader: string;
 *   secretSalt: string;
 *   merkleRoot?: string; // Optional, defaults to '0'
 *   threshold?: number; // Optional, defaults to 100
 *   actionType?: 'view' | 'click' | 'conversion';
 * }
 */
router.post('/generate', async (req, res) => {
  await handleGenerateProof(req, res, 'view');
});

/**
 * POST /proofs/generate-click
 * Convenience endpoint for click proofs
 */
router.post('/generate-click', async (req, res) => {
  await handleGenerateProof(req, res, 'click');
});

/**
 * POST /proofs/generate-conversion
 * Convenience endpoint for conversion proofs
 */
router.post('/generate-conversion', async (req, res) => {
  await handleGenerateProof(req, res, 'conversion');
});

/**
 * POST /proofs/verify
 * Verify ZK proof
 * Body: {
 *   proof: any;
 *   publicSignals: string[];
 * }
 */
router.post('/verify', async (req, res) => {
  try {
    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        error: 'Missing required fields: proof, publicSignals'
      });
    }

    const isValid = await proofGenerator.verifyProof(proof, publicSignals);

    res.json({
      valid: isValid
    });
  } catch (error) {
    logger.error('Error verifying ZK proof', error);
    res.status(500).json({
      error: 'Failed to verify ZK proof',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /proofs/encrypt-impression
 * Encrypt an impression count (for homomorphic aggregation)
 * Query params: adId, contentId
 */
router.get('/encrypt-impression', async (req, res) => {
  try {
    const { adId, contentId } = req.query;

    if (!adId || !contentId) {
      return res.status(400).json({
        error: 'Missing required query params: adId, contentId'
      });
    }

    const encrypted = homomorphicEncryption.encryptImpression(
      adId as string,
      contentId as string
    );

    res.json({
      encrypted
    });
  } catch (error) {
    logger.error('Error encrypting impression', error);
    res.status(500).json({
      error: 'Failed to encrypt impression',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /proofs/aggregate
 * Aggregate encrypted impressions (homomorphic addition)
 * Body: {
 *   encryptedImpressions: string[];
 * }
 */
router.post('/aggregate', async (req, res) => {
  try {
    const { encryptedImpressions } = req.body;

    if (!Array.isArray(encryptedImpressions)) {
      return res.status(400).json({
        error: 'encryptedImpressions must be an array'
      });
    }

    const aggregate = homomorphicEncryption.aggregateImpressions(encryptedImpressions);

    res.json({
      encryptedAggregate: aggregate
    });
  } catch (error) {
    logger.error('Error aggregating impressions', error);
    res.status(500).json({
      error: 'Failed to aggregate impressions',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /proofs/decrypt-aggregate
 * Decrypt aggregate (admin only - requires private key)
 * Body: {
 *   encryptedAggregate: string;
 * }
 */
router.post('/decrypt-aggregate', async (req, res) => {
  try {
    const { encryptedAggregate } = req.body;

    if (!encryptedAggregate) {
      return res.status(400).json({
        error: 'Missing required field: encryptedAggregate'
      });
    }

    // Check if admin (in production, add proper authentication)
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_KEY;
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    const count = homomorphicEncryption.decryptAggregate(encryptedAggregate);

    res.json({
      count
    });
  } catch (error) {
    logger.error('Error decrypting aggregate', error);
    res.status(500).json({
      error: 'Failed to decrypt aggregate',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
