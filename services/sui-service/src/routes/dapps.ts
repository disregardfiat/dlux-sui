import express from 'express';
import { SUIdApp } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { dappRepository } from '../repositories/dappRepository';

const router = express.Router();

// Get dApp by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const dapp = await dappRepository.findById(id);

    if (!dapp) {
      return res.status(404).json({ error: 'dApp not found' });
    }

    res.json(dapp);

  } catch (error) {
    logger.error('Error getting dApp', { id: req.params.id, error });
    res.status(500).json({ error: 'Failed to get dApp' });
  }
});

// Get dApps by owner
router.get('/owner/:suiAddress', async (req, res) => {
  try {
    const { suiAddress } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const dapps = await dappRepository.findByOwner(suiAddress);

    res.json({
      dapps: dapps.slice(offset, offset + limit),
      total: dapps.length,
      limit,
      offset
    });

  } catch (error) {
    logger.error('Error getting dApps by owner', { suiAddress: req.params.suiAddress, error });
    res.status(500).json({ error: 'Failed to get dApps' });
  }
});

// Search dApps
router.get('/search', async (req, res) => {
  try {
    const { q: query, tags } = req.query;

    let dapps: SUIdApp[];

    if (query && typeof query === 'string') {
      dapps = await dappRepository.search(query);
    } else if (tags) {
      const tagsArray = Array.isArray(tags) ? tags as string[] : [tags as string];
      dapps = await dappRepository.findByTags(tagsArray);
    } else {
      return res.status(400).json({ error: 'Search query or tags are required' });
    }

    res.json({
      dapps,
      total: dapps.length,
      query: query || tags
    });

  } catch (error) {
    logger.error('Error searching dApps', { query: req.query.q, tags: req.query.tags, error });
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get all dApps (paginated)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const dapps = await dappRepository.findAll(limit, offset);

    res.json({
      dapps,
      limit,
      offset
    });

  } catch (error) {
    logger.error('Error getting dApps', error);
    res.status(500).json({ error: 'Failed to get dApps' });
  }
});

// Create dApp (for testing - in production this would come from blockchain)
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      owner,
      version,
      manifest,
      blobIds,
      tags,
      permlink,
      category,
      postingFee
    }: {
      name: string;
      description: string;
      owner: string;
      version?: string;
      manifest?: any;
      blobIds?: string[];
      tags?: string[];
      permlink?: string;
      category?: string;
      postingFee?: number;
    } = req.body;

    if (!name || !owner) {
      return res.status(400).json({ error: 'Name and owner are required' });
    }

    const dapp: SUIdApp = {
      id: `dapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: description || '',
      owner,
      permlink: permlink || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      version: version || '1.0.0',
      manifest: manifest || {},
      blobIds: blobIds || [],
      tags: tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await dappRepository.save(dapp);

    // Create prediction market if posting fee provided
    if (postingFee && postingFee > 0) {
      try {
        const axios = require('axios');
        const PM_SERVICE = process.env.PM_SERVICE_URL || 'http://localhost:3008';
        const marketContribution = postingFee * 0.5; // 50% to market

        await axios.post(`${PM_SERVICE}/markets`, {
          dappId: dapp.id,
          safetyMetric: 'nsfw', // Default - can be customized
          description: `Safety review for ${dapp.name}`,
          postingFeeContribution: marketContribution,
          triggeredBy: 'posting',
          triggeredByAddress: owner
        });

        logger.info('Created prediction market for dApp', { 
          dappId: dapp.id, 
          contribution: marketContribution 
        });
      } catch (pmError) {
        logger.error('Failed to create prediction market', pmError);
        // Don't fail dApp creation if PM creation fails
      }
    }

    res.status(201).json(dapp);

  } catch (error) {
    logger.error('Error creating dApp', error);
    res.status(500).json({ error: 'Failed to create dApp' });
  }
});

export { router as dappsRouter };