import express from 'express';
import { impressionRepository } from '../repositories/impressionRepository';
import { merkleAggregator } from '../services/merkleAggregator';
import { logger } from '../utils/logger';
import axios from 'axios';

const router = express.Router();

const ZK_SERVICE_URL = process.env.ZK_SERVICE_URL || 'http://localhost:3010';
const AD_IMPRESSION_THRESHOLD = parseInt(process.env.AD_IMPRESSION_THRESHOLD || '100', 10);

/**
 * POST /impressions
 * Record ad impression with ZK proof (privacy-preserving)
 * Body: {
 *   adId: string;
 *   contentId: string;
 *   zkProof: { proof: any; publicSignals: string[] };
 *   proofHash: string;
 *   encryptedViewer: string;
 *   blockHeader: string;
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      adId,
      contentId,
      zkProof,
      proofHash,
      encryptedViewer,
      blockHeader
    } = req.body;

    if (!adId || !contentId || !zkProof || !proofHash || !encryptedViewer || !blockHeader) {
      return res.status(400).json({
        error: 'Missing required fields: adId, contentId, zkProof, proofHash, encryptedViewer, blockHeader'
      });
    }

    let verified = false;
    // Verify ZK proof (optional - can be done async)
    try {
      const verifyRes = await axios.post(`${ZK_SERVICE_URL}/proofs/verify`, {
        proof: zkProof.proof,
        publicSignals: zkProof.publicSignals
      });

      verified = !!verifyRes.data.valid;
      if (!verified) {
        logger.warn('Invalid ZK proof received', { adId, contentId });
        return res.status(400).json({ error: 'Invalid ZK proof' });
      }
    } catch (error) {
      logger.error('Failed to verify ZK proof', error);
      // Continue anyway - verification can be done later
    }

    // Save impression
    const impressionId = await impressionRepository.saveImpression({
      adId,
      contentId,
      zkProof: JSON.stringify(zkProof),
      proofHash,
      encryptedViewer,
      blockHeader,
      verified
    });

    // Check if threshold reached for Merkle aggregation
    const count = await impressionRepository.countByContentId(contentId);
    if (count >= AD_IMPRESSION_THRESHOLD) {
      // Trigger Merkle tree building (async)
      merkleAggregator.buildMerkleTree(contentId, AD_IMPRESSION_THRESHOLD)
        .then(async (treeResult) => {
          if (treeResult) {
            // Get encrypted impressions for aggregation
            const impressions = await impressionRepository.findByContentId(contentId);
            const encryptedImpressions = impressions.map(imp => imp.encryptedViewer);

            // Aggregate encrypted impressions (homomorphic)
            const aggregateRes = await axios.post(`${ZK_SERVICE_URL}/proofs/aggregate`, {
              encryptedImpressions
            });

            // Save aggregate
            await impressionRepository.saveAggregate({
              adId,
              contentId,
              encryptedCount: aggregateRes.data.encryptedAggregate,
              merkleRoot: treeResult.merkleRoot,
              threshold: AD_IMPRESSION_THRESHOLD,
              currentCount: treeResult.leafCount,
              reachedAt: new Date(),
              distributed: false
            });

            logger.info('Merkle tree built and aggregate saved', {
              contentId,
              merkleRoot: treeResult.merkleRoot.substring(0, 16) + '...'
            });
          }
        })
        .catch(error => {
          logger.error('Failed to build Merkle tree', error);
        });
    }

    res.json({
      success: true,
      impressionId,
      count,
      thresholdReached: count >= AD_IMPRESSION_THRESHOLD
    });
  } catch (error) {
    logger.error('Error recording impression', error);
    res.status(500).json({
      error: 'Failed to record impression',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /impressions
 * List impressions (with filters)
 * Query: adId?, contentId?, verified?, limit?, offset?
 */
router.get('/', async (req, res) => {
  try {
    const adId = typeof req.query.adId === 'string' ? req.query.adId : undefined;
    const contentId = typeof req.query.contentId === 'string' ? req.query.contentId : undefined;
    const verified =
      typeof req.query.verified === 'string' ? req.query.verified === 'true' : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined;

    const result = await impressionRepository.list({ adId, contentId, verified, limit, offset });
    res.json(result);
  } catch (error) {
    logger.error('Error listing impressions', error);
    res.status(500).json({ error: 'Failed to list impressions' });
  }
});

/**
 * GET /impressions/:id
 * Get impression details
 */
router.get('/:id', async (req, res) => {
  try {
    const impression = await impressionRepository.findById(req.params.id);
    if (!impression) return res.status(404).json({ error: 'Impression not found' });

    // Privacy: omit zkProof/encryptedViewer by default.
    res.json({
      id: impression.id,
      adId: impression.adId,
      contentId: impression.contentId,
      proofHash: impression.proofHash,
      blockHeader: impression.blockHeader,
      timestamp: impression.timestamp,
      verified: impression.verified,
      merklePath: impression.merklePath || '',
      merkleIndex: impression.merkleIndex || 0,
      walrusDrawdownUsed: impression.walrusDrawdownUsed || false
    });
  } catch (error) {
    logger.error('Error fetching impression', error);
    res.status(500).json({ error: 'Failed to fetch impression' });
  }
});

/**
 * GET /impressions/proof/:proofHash
 * Get impression and Merkle proof data for a proof hash
 * Used by Walrus nodes to verify proofs before drawdown
 */
router.get('/proof/:proofHash', async (req, res) => {
  try {
    const { proofHash } = req.params;
    const impression = await impressionRepository.findByProofHash(proofHash);
    
    if (!impression) {
      return res.status(404).json({ 
        error: 'Proof not found',
        proofHash 
      });
    }

    // Parse Merkle path if available
    let merklePath: string[] = [];
    const merkleIndices: number[] = [];
    if (impression.merklePath) {
      try {
        merklePath = JSON.parse(impression.merklePath);
      } catch {
        logger.warn('Failed to parse Merkle path', { proofHash });
      }
    }

    res.json({
      exists: true,
      verified: impression.verified,
      walrusDrawdownUsed: impression.walrusDrawdownUsed || false,
      contentId: impression.contentId,
      adId: impression.adId,
      proofHash: impression.proofHash,
      merklePath,
      merkleIndex: impression.merkleIndex || 0,
      blockHeader: impression.blockHeader,
      timestamp: impression.timestamp
    });
  } catch (error) {
    logger.error('Error fetching proof', error);
    res.status(500).json({ error: 'Failed to fetch proof' });
  }
});

/**
 * POST /impressions/:id/verify
 * Verify impression (MVP: marks as verified)
 * Body: { method, cookieValue?, checksum? }
 */
router.post('/:id/verify', async (req, res) => {
  try {
    const ok = await impressionRepository.setVerified(req.params.id, true);
    if (!ok) return res.status(404).json({ error: 'Impression not found' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error verifying impression', error);
    res.status(500).json({ error: 'Failed to verify impression' });
  }
});

/**
 * GET /impressions/content/:contentId
 * Get impressions for a content
 */
router.get('/content/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const impressions = await impressionRepository.findByContentId(contentId);

    res.json({
      impressions: impressions.map(imp => ({
        id: imp.id,
        adId: imp.adId,
        proofHash: imp.proofHash,
        timestamp: imp.timestamp,
        verified: imp.verified
        // Note: zkProof and encryptedViewer not returned for privacy
      })),
      count: impressions.length
    });
  } catch (error) {
    logger.error('Error fetching impressions', error);
    res.status(500).json({ error: 'Failed to fetch impressions' });
  }
});

/**
 * GET /impressions/ad/:adId
 * Get impressions for an ad
 */
router.get('/ad/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    const impressions = await impressionRepository.findByAdId(adId);

    res.json({
      impressions: impressions.map(imp => ({
        id: imp.id,
        contentId: imp.contentId,
        proofHash: imp.proofHash,
        timestamp: imp.timestamp,
        verified: imp.verified
      })),
      count: impressions.length
    });
  } catch (error) {
    logger.error('Error fetching impressions', error);
    res.status(500).json({ error: 'Failed to fetch impressions' });
  }
});

/**
 * GET /impressions/aggregate/:contentId
 * Get encrypted aggregate for content
 */
router.get('/aggregate/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const aggregate = await impressionRepository.findAggregateByContentId(contentId);

    if (!aggregate) {
      return res.status(404).json({ error: 'Aggregate not found' });
    }

    res.json({
      encryptedCount: aggregate.encryptedCount,
      merkleRoot: aggregate.merkleRoot,
      threshold: aggregate.threshold,
      currentCount: aggregate.currentCount,
      reachedAt: aggregate.reachedAt,
      distributed: aggregate.distributed
    });
  } catch (error) {
    logger.error('Error fetching aggregate', error);
    res.status(500).json({ error: 'Failed to fetch aggregate' });
  }
});

/**
 * GET /impressions/merkle/:contentId
 * Get Merkle root and proof paths for content
 */
router.get('/merkle/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const treeResult = await merkleAggregator.buildMerkleTree(contentId, AD_IMPRESSION_THRESHOLD);

    if (!treeResult) {
      return res.status(404).json({
        error: 'Threshold not met or tree not built',
        threshold: AD_IMPRESSION_THRESHOLD
      });
    }

    res.json({
      merkleRoot: treeResult.merkleRoot,
      proofs: treeResult.proofs,
      leafCount: treeResult.leafCount
    });
  } catch (error) {
    logger.error('Error fetching Merkle tree', error);
    res.status(500).json({ error: 'Failed to fetch Merkle tree' });
  }
});

/**
 * POST /impressions/settle
 * Mark impressions as settled (after on-chain record_impression_with_escrow). Prevents double-spend.
 * Body: { impressionIds: string[] }
 */
router.post('/settle', async (req, res) => {
  try {
    const { impressionIds } = req.body || {};
    if (!Array.isArray(impressionIds) || impressionIds.length === 0) {
      return res.status(400).json({ error: 'impressionIds (array of strings) is required' });
    }
    await impressionRepository.markSettled(impressionIds);
    res.json({ success: true, count: impressionIds.length });
  } catch (error) {
    logger.error('Error marking impressions settled', error);
    res.status(500).json({ error: 'Failed to mark impressions settled' });
  }
});

/**
 * POST /impressions/mark-revenue-distributed
 * Mark impressions as revenue-distributed (after distribute_revenue). Prevents double payout.
 * Body: { impressionIds: string[] }
 */
router.post('/mark-revenue-distributed', async (req, res) => {
  try {
    const { impressionIds } = req.body || {};
    if (!Array.isArray(impressionIds) || impressionIds.length === 0) {
      return res.status(400).json({ error: 'impressionIds (array of strings) is required' });
    }
    await impressionRepository.markRevenueDistributed(impressionIds);
    res.json({ success: true, count: impressionIds.length });
  } catch (error) {
    logger.error('Error marking impressions revenue-distributed', error);
    res.status(500).json({ error: 'Failed to mark impressions revenue-distributed' });
  }
});

/**
 * POST /impressions/mark-walrus-drawdown-used
 * Mark proof hashes as used in Walrus drawdown (prevents double-spend)
 * Body: { proofHashes: string[] }
 */
router.post('/mark-walrus-drawdown-used', async (req, res) => {
  try {
    const { proofHashes } = req.body || {};
    if (!Array.isArray(proofHashes) || proofHashes.length === 0) {
      return res.status(400).json({ error: 'proofHashes (array of strings) is required' });
    }
    
    // Check for already-used proofs
    const { used, unused } = await impressionRepository.checkWalrusDrawdownUsed(proofHashes);
    if (used.length > 0) {
      return res.status(400).json({
        error: 'Some proofs already used in Walrus drawdown',
        used,
        unused
      });
    }
    
    await impressionRepository.markWalrusDrawdownUsed(proofHashes);
    res.json({ 
      success: true, 
      count: proofHashes.length,
      proofHashes 
    });
  } catch (error) {
    logger.error('Error marking proofs as used in Walrus drawdown', error);
    res.status(500).json({ error: 'Failed to mark proofs as used' });
  }
});

/**
 * POST /impressions/queue-walrus-drawdown
 * Queue proof hashes for off-chain batch processing
 * Body: { proofHashes: string[] }
 */
router.post('/queue-walrus-drawdown', async (req, res) => {
  try {
    const { proofHashes } = req.body || {};
    if (!Array.isArray(proofHashes) || proofHashes.length === 0) {
      return res.status(400).json({ error: 'proofHashes (array of strings) is required' });
    }
    
    // Check for already-used or pending proofs
    const { used } = await impressionRepository.checkWalrusDrawdownUsed(proofHashes);
    if (used.length > 0) {
      return res.status(400).json({
        error: 'Some proofs already used in Walrus drawdown',
        used
      });
    }
    
    await impressionRepository.queueWalrusDrawdown(proofHashes);
    res.json({ 
      success: true, 
      queued: proofHashes.length,
      proofHashes,
      message: 'Proofs queued for batch processing'
    });
  } catch (error) {
    logger.error('Error queueing proofs for Walrus drawdown', error);
    res.status(500).json({ error: 'Failed to queue proofs' });
  }
});

/**
 * GET /impressions/pending-drawdowns
 * Get all pending drawdowns (for scheduler service)
 */
router.get('/pending-drawdowns', async (req, res) => {
  try {
    const pending = await impressionRepository.getPendingDrawdowns();
    res.json({
      success: true,
      count: pending.length,
      pending: pending.map(p => ({
        contentId: p.contentId,
        proofCount: p.proofHashes.length,
        proofHashes: p.proofHashes
      }))
    });
  } catch (error) {
    logger.error('Error fetching pending drawdowns', error);
    res.status(500).json({ error: 'Failed to fetch pending drawdowns' });
  }
});

export default router;
