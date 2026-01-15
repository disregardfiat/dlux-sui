import express from 'express';
import multer from 'multer';
import { logger } from '../utils/logger';
import { blobRepository } from '../repositories/blobRepository';
import crypto from 'crypto';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Upload single file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const blobId = crypto.randomBytes(16).toString('hex');
    
    // Store blob
    await blobRepository.save({
      id: blobId,
      data: file.buffer,
      contentType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
      uploadedAt: new Date()
    });

    logger.info('File uploaded', { 
      blobId, 
      contentType: file.mimetype, 
      size: file.size 
    });

    res.json({
      blobId,
      contentType: file.mimetype,
      size: file.size,
      url: `/walrus/${blobId}`
    });

  } catch (error: any) {
    logger.error('Error uploading file', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

// Upload multiple files
router.post('/upload/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files as Express.Multer.File[];
    const results = [];

    for (const file of files) {
      const blobId = crypto.randomBytes(16).toString('hex');
      
      await blobRepository.save({
        id: blobId,
        data: file.buffer,
        contentType: file.mimetype,
        size: file.size,
        originalName: file.originalname,
        uploadedAt: new Date()
      });

      results.push({
        blobId,
        contentType: file.mimetype,
        size: file.size,
        originalName: file.originalname,
        url: `/walrus/${blobId}`
      });
    }

    logger.info('Multiple files uploaded', { count: results.length });

    res.json({ blobs: results });

  } catch (error: any) {
    logger.error('Error uploading files', error);
    res.status(500).json({ error: error.message || 'Failed to upload files' });
  }
});

// Get blob by ID
router.get('/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;
    const blob = await blobRepository.findById(blobId);

    if (!blob) {
      return res.status(404).json({ error: 'Blob not found' });
    }

    res.setHeader('Content-Type', blob.contentType);
    res.setHeader('Content-Length', blob.size);
    res.setHeader('Content-Disposition', `inline; filename="${blob.originalName}"`);
    res.send(blob.data);

  } catch (error: any) {
    logger.error('Error getting blob', error);
    res.status(500).json({ error: error.message || 'Failed to get blob' });
  }
});

export { router as uploadRouter };
