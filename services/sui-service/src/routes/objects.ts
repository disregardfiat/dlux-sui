import express from 'express';
import { SUITextObject } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { textObjectRepository } from '../repositories/textObjectRepository';

const router = express.Router();

// Get text object by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const textObject = await textObjectRepository.findById(id);

    if (!textObject) {
      return res.status(404).json({ error: 'Text object not found' });
    }

    res.json(textObject);

  } catch (error) {
    logger.error('Error getting text object', { id: req.params.id, error });
    res.status(500).json({ error: 'Failed to get text object' });
  }
});

// Get text objects by owner
router.get('/owner/:suiAddress', async (req, res) => {
  try {
    const { suiAddress } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const textObjects = await textObjectRepository.findByOwner(suiAddress);

    res.json({
      objects: textObjects.slice(offset, offset + limit),
      total: textObjects.length,
      limit,
      offset
    });

  } catch (error) {
    logger.error('Error getting text objects by owner', { suiAddress: req.params.suiAddress, error });
    res.status(500).json({ error: 'Failed to get text objects' });
  }
});

// Search text objects
router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const textObjects = await textObjectRepository.search(query);

    res.json({
      objects: textObjects,
      total: textObjects.length,
      query
    });

  } catch (error) {
    logger.error('Error searching text objects', { query: req.query.q, error });
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get all text objects (paginated)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const textObjects = await textObjectRepository.findAll(limit, offset);

    res.json({
      objects: textObjects,
      limit,
      offset
    });

  } catch (error) {
    logger.error('Error getting text objects', error);
    res.status(500).json({ error: 'Failed to get text objects' });
  }
});

// Create text object (for testing - in production this would come from blockchain)
router.post('/', async (req, res) => {
  try {
    const { owner, content, metadata }: {
      owner: string;
      content: string;
      metadata?: Record<string, any>;
    } = req.body;

    if (!owner || !content) {
      return res.status(400).json({ error: 'Owner and content are required' });
    }

    const textObject: SUITextObject = {
      id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      owner,
      content,
      metadata: metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await textObjectRepository.save(textObject);

    res.status(201).json(textObject);

  } catch (error) {
    logger.error('Error creating text object', error);
    res.status(500).json({ error: 'Failed to create text object' });
  }
});

export { router as objectsRouter };