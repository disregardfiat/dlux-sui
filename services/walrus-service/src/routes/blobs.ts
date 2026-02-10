import express from 'express';
import multer from 'multer';
import axios from 'axios';
import { logger } from '../utils/logger';
import { walrusClient } from '../walrus/client';
import { blobRepository } from '../repositories/blobRepository';

const router = express.Router();
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const ORPHAN_AGE_HOURS = parseInt(process.env.ORPHAN_CLEANUP_AGE_HOURS || '48', 10);

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  storage: multer.memoryStorage()
});

// Upload blob
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { buffer, originalname, mimetype, size } = req.file;
    const uploader = req.body.uploader || req.ip;

    logger.info('Uploading blob', { filename: originalname, size, mimetype });

    // Store blob in Walrus
    const blobId = await walrusClient.storeBlob(buffer);

    // Save metadata and local copy (so we can serve if upstream 404s before replication)
    await blobRepository.save(blobId, {
      size,
      contentType: mimetype,
      uploadedBy: uploader,
      checksum: generateChecksum(buffer)
    }, buffer);

    res.json({
      blobId,
      size,
      contentType: mimetype,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error uploading blob', error);
    res.status(500).json({ error: 'Failed to upload blob' });
  }
});

// Upload multiple blobs (up to 10)
router.post('/upload/multiple', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploader = (req.body?.uploader as string) || req.ip;
    const uploadedAt = new Date().toISOString();

    const blobs = [];
    for (const file of files) {
      const { buffer, originalname, mimetype, size } = file;
      logger.info('Uploading blob', { filename: originalname, size, mimetype });

      const blobId = await walrusClient.storeBlob(buffer);
      await blobRepository.save(blobId, {
        size,
        contentType: mimetype,
        uploadedBy: uploader,
        checksum: generateChecksum(buffer)
      }, buffer);

      blobs.push({ blobId, size, contentType: mimetype, uploadedAt });
    }

    res.json({ blobs });
  } catch (error) {
    logger.error('Error uploading blobs', error);
    res.status(500).json({ error: 'Failed to upload blobs' });
  }
});

// Download blob
router.get('/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;

    // Get blob metadata first
    const metadata = await blobRepository.findById(blobId);
    if (!metadata) {
      return res.status(404).json({ error: 'Blob not found' });
    }

    // Prefer local copy (avoids 404 when upstream hasn't replicated yet)
    let blobData = blobRepository.getContent(blobId);
    if (!blobData) {
      try {
        blobData = await walrusClient.getBlob(blobId);
        blobRepository.setContent(blobId, blobData);
      } catch (upstreamError: any) {
        const status = upstreamError?.response?.status;
        logger.warn('Upstream Walrus getBlob failed, no local copy', { blobId, status });
        return res.status(status === 404 ? 404 : 500).json({ error: 'Blob not found' });
      }
    }

    // Set appropriate headers
    if (metadata.contentType) {
      res.setHeader('Content-Type', metadata.contentType);
    }
    res.setHeader('Content-Length', metadata.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year

    res.send(blobData);

  } catch (error) {
    logger.error('Error downloading blob', { blobId: req.params.blobId, error });
    res.status(500).json({ error: 'Failed to download blob' });
  }
});

// Get blob info
router.get('/:blobId/info', async (req, res) => {
  try {
    const { blobId } = req.params;

    const metadata = await blobRepository.findById(blobId);
    if (!metadata) {
      return res.status(404).json({ error: 'Blob not found' });
    }

    let walrusInfo = null;
    try {
      walrusInfo = await walrusClient.getBlobInfo(blobId);
    } catch (upstreamErr) {
      logger.debug('Upstream getBlobInfo failed (optional)', { blobId });
    }

    res.json({
      ...metadata,
      ...(walrusInfo && { walrusInfo })
    });

  } catch (error) {
    logger.error('Error getting blob info', { blobId: req.params.blobId, error });
    res.status(404).json({ error: 'Blob not found' });
  }
});

// List blobs (paginated)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const uploader = req.query.uploader as string;

    let blobs;
    if (uploader) {
      blobs = await blobRepository.findByUploader(uploader);
    } else {
      blobs = await blobRepository.findAll();
    }

    res.json({
      blobs: blobs.slice(offset, offset + limit),
      total: blobs.length,
      limit,
      offset
    });

  } catch (error) {
    logger.error('Error listing blobs', error);
    res.status(500).json({ error: 'Failed to list blobs' });
  }
});

// Delete blob
router.delete('/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;

    // Note: Walrus doesn't support deletion, but we can remove metadata
    const deleted = await blobRepository.delete(blobId);

    if (!deleted) {
      return res.status(404).json({ error: 'Blob not found' });
    }

    res.json({ success: true, message: 'Blob metadata deleted' });

  } catch (error) {
    logger.error('Error deleting blob', { blobId: req.params.blobId, error });
    res.status(500).json({ error: 'Failed to delete blob' });
  }
});

// Compute total storage cost for a set of blobs (for posting fee: min = 2×storage + 1 SUI)
const TERM_LENGTH_DAYS = 730;
const COST_PER_GB_PER_YEAR = 0.01; // SUI per GB per year

router.post('/billing/batch', async (req, res) => {
  try {
    const { blobIds } = req.body;
    if (!Array.isArray(blobIds) || blobIds.length === 0) {
      return res.status(400).json({ error: 'blobIds array is required' });
    }
    let totalSizeBytes = 0;
    for (const id of blobIds) {
      const meta = await blobRepository.findById(String(id));
      if (meta) totalSizeBytes += meta.size;
    }
    const sizeInGB = totalSizeBytes / (1024 * 1024 * 1024);
    const storageCost = sizeInGB * COST_PER_GB_PER_YEAR * (TERM_LENGTH_DAYS / 365);
    const minPostingFee = Math.max(2 * storageCost + 1, 1.0); // Minimum 1 SUI
    res.json({
      blobIds,
      totalSizeBytes,
      storageCost,
      minPostingFee,
      termLengthDays: TERM_LENGTH_DAYS
    });
  } catch (error) {
    logger.error('Error computing batch billing', error);
    res.status(500).json({ error: 'Failed to compute batch billing' });
  }
});

// Cleanup orphan blobs: uploaded but no dApp post succeeded within ORPHAN_AGE_HOURS. Remix-safe (never deletes referenced blobs).
router.post('/admin/cleanup-orphans', async (req, res) => {
  try {
    const adminKey = process.env.ORPHAN_CLEANUP_ADMIN_KEY || '';
    if (adminKey && req.headers['x-admin-key'] !== adminKey) {
      return res.status(403).json({ error: 'Admin key required' });
    }
    let referenced: string[] = [];
    try {
      const refRes = await axios.get(`${DGRAPH_SERVICE_URL}/installs/blobs/referenced`, { timeout: 15000 });
      referenced = refRes.data?.blobIds || [];
    } catch (e) {
      logger.warn('Could not fetch referenced blobs from DGraph', { error: (e as Error)?.message });
      return res.status(502).json({ error: 'Could not fetch referenced blobs from DGraph' });
    }
    const refSet = new Set(referenced);
    const allBlobs = await blobRepository.findAll();
    const cutoff = Date.now() - ORPHAN_AGE_HOURS * 60 * 60 * 1000;
    const toDelete = allBlobs.filter((b) => !refSet.has(b.id) && b.uploadedAt.getTime() < cutoff);
    let deleted = 0;
    for (const b of toDelete) {
      try {
        await blobRepository.delete(b.id);
        deleted++;
      } catch (e) {
        logger.warn('Failed to delete orphan blob', { blobId: b.id, error: (e as Error)?.message });
      }
    }
    logger.info('Orphan cleanup completed', { deleted, totalChecked: allBlobs.length, referencedCount: refSet.size });
    res.json({ deleted, totalChecked: allBlobs.length, referencedCount: refSet.size });
  } catch (error) {
    logger.error('Orphan cleanup failed', error);
    res.status(500).json({ error: 'Orphan cleanup failed' });
  }
});

// Get storage stats
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await blobRepository.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting storage stats', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get billing info for a blob (term length, costs, etc.)
router.get('/:blobId/billing', async (req, res) => {
  try {
    const { blobId } = req.params;

    const metadata = await blobRepository.findById(blobId);
    if (!metadata) {
      return res.status(404).json({ error: 'Blob not found' });
    }

    // Get term info from Walrus (mock for MVP - in production, this would query Walrus API)
    // Walrus terms are typically 2 years (730 days)
    const termLengthDays = 730;
    const termStart = metadata.uploadedAt || new Date();
    const termEnd = new Date(termStart.getTime() + termLengthDays * 24 * 60 * 60 * 1000);

    // Calculate term progress
    const now = Date.now();
    const termProgressPercent = Math.min(
      ((now - termStart.getTime()) / (termEnd.getTime() - termStart.getTime())) * 100,
      100
    );

    const sizeInGB = metadata.size / (1024 * 1024 * 1024);
    const storageCost = sizeInGB * COST_PER_GB_PER_YEAR * (termLengthDays / 365);
    const renewalCost = storageCost; // Same cost for renewal

    // Currently funded amount (will be calculated by billing service)
    const funded = 0; // This gets populated by the billing service
    const coveragePercent = funded > 0 ? (funded / storageCost) * 100 : 0;

    res.json({
      blobId,
      termStart: termStart.toISOString(),
      termEnd: termEnd.toISOString(),
      termLengthDays,
      storageCost,
      renewalCost,
      funded,
      coveragePercent,
      termProgressPercent,
      precarious: false, // Will be calculated by billing service
      autoRenewEligible: false // Will be calculated by billing service
    });
  } catch (error) {
    logger.error('Error getting blob billing info', { blobId: req.params.blobId, error });
    res.status(500).json({ error: 'Failed to get blob billing info' });
  }
});

// Helper function to generate checksum
function generateChecksum(data: Buffer): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

export { router as blobRouter };