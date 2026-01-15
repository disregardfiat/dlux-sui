import express from 'express';
import multer from 'multer';
import { logger } from '../utils/logger';
import { walrusClient } from '../walrus/client';
import { blobRepository } from '../repositories/blobRepository';

const router = express.Router();

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

    // Save metadata
    await blobRepository.save(blobId, {
      size,
      contentType: mimetype,
      uploadedBy: uploader,
      checksum: generateChecksum(buffer)
    });

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

// Download blob
router.get('/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;

    // Get blob metadata first
    const metadata = await blobRepository.findById(blobId);
    if (!metadata) {
      return res.status(404).json({ error: 'Blob not found' });
    }

    // Get blob from Walrus
    const blobData = await walrusClient.getBlob(blobId);

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

    // Get additional info from Walrus
    const walrusInfo = await walrusClient.getBlobInfo(blobId);

    res.json({
      ...metadata,
      walrusInfo
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
      blobs = await blobRepository.findAll(limit, offset);
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

// Helper function to generate checksum
function generateChecksum(data: Buffer): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

export { router as blobRouter };