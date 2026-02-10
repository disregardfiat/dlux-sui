import express from 'express';
import { nodeRegistryVerifier } from '../services/nodeRegistryVerifier';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /node-registry/verify
 * Verify a Walrus node registry blob
 * Body: { blobId: string, operatorAddress: string }
 */
router.post('/verify', async (req, res) => {
  try {
    const { blobId, operatorAddress } = req.body;

    if (!blobId || !operatorAddress) {
      return res.status(400).json({
        error: 'Missing required fields: blobId, operatorAddress'
      });
    }

    const result = await nodeRegistryVerifier.verifyRegistry(blobId, operatorAddress);

    if (!result.verified) {
      return res.status(400).json({
        verified: false,
        error: result.error || 'Verification failed'
      });
    }

    res.json({
      verified: true,
      nodeData: result.nodeData
    });
  } catch (error) {
    logger.error('Error verifying node registry', error);
    res.status(500).json({
      error: 'Failed to verify node registry',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /node-registry/verify-batch
 * Batch verify multiple node registries
 * Body: { registries: [{ blobId: string, operatorAddress: string }] }
 */
router.post('/verify-batch', async (req, res) => {
  try {
    const { registries } = req.body;

    if (!Array.isArray(registries) || registries.length === 0) {
      return res.status(400).json({
        error: 'Missing required field: registries (array)'
      });
    }

    const blobIds = registries.map(r => r.blobId);
    const operatorAddresses = registries.map(r => r.operatorAddress);

    const results = await nodeRegistryVerifier.verifyBatch(blobIds, operatorAddresses);

    res.json({
      results,
      verified: results.filter(r => r.verified).length,
      total: results.length
    });
  } catch (error) {
    logger.error('Error batch verifying node registries', error);
    res.status(500).json({
      error: 'Failed to batch verify node registries',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
