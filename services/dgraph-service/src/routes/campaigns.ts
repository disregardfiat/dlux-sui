import express from 'express';
import { logger } from '../utils/logger';
import { campaignRepository, type CampaignStatus } from '../repositories/campaignRepository';
import { sameParty } from '../middleware/auth';

const router = express.Router();

/**
 * POST /campaigns
 * Create ad campaign. Requires JWT and advertiser must match authenticated identity.
 */
router.post('/', async (req, res) => {
  try {
    const {
      advertiser,
      title,
      description,
      targetUrl,
      placements,
      contentIds,
      bid,
      totalBudget,
      startAt,
      endAt
    } = req.body || {};

    if (!advertiser || !title || !targetUrl || !Array.isArray(placements) || placements.length === 0) {
      return res.status(400).json({ error: 'advertiser, title, targetUrl, and placements are required' });
    }
    if (!req.auth || !sameParty(req.auth.suiAddress, advertiser)) {
      return res.status(403).json({ error: 'Must be authenticated as the advertiser to create a campaign' });
    }
    if (bid === undefined || Number.isNaN(Number(bid)) || Number(bid) <= 0) {
      return res.status(400).json({ error: 'bid must be a positive number' });
    }
    if (totalBudget === undefined || Number.isNaN(Number(totalBudget)) || Number(totalBudget) <= 0) {
      return res.status(400).json({ error: 'totalBudget must be a positive number' });
    }

    const campaign = await campaignRepository.create({
      advertiser,
      title,
      description,
      targetUrl,
      placements,
      contentIds: Array.isArray(contentIds) ? contentIds : undefined,
      bid: Number(bid),
      totalBudget: Number(totalBudget),
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined
    });

    res.status(201).json(campaign);
  } catch (error: any) {
    logger.error('Failed to create campaign', error);
    res.status(500).json({ error: error?.message || 'Failed to create campaign' });
  }
});

/**
 * GET /campaigns
 * List campaigns. When advertiser filter is present, requires JWT and advertiser must match identity.
 */
router.get('/', async (req, res) => {
  try {
    const advertiser = typeof req.query.advertiser === 'string' ? req.query.advertiser : undefined;
    if (advertiser && (!req.auth || !sameParty(req.auth.suiAddress, advertiser))) {
      return res.status(403).json({ error: 'Can only list your own campaigns when filtering by advertiser' });
    }
    const status = typeof req.query.status === 'string' ? (req.query.status as CampaignStatus) : undefined;
    const placement = typeof req.query.placement === 'string' ? req.query.placement : undefined;
    const activeOnly = req.query.activeOnly === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const result = await campaignRepository.list({ advertiser, status, placement, activeOnly, limit, offset });
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to list campaigns', error);
    res.status(500).json({ error: error?.message || 'Failed to list campaigns' });
  }
});

/**
 * GET /campaigns/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const campaign = await campaignRepository.getById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (error: any) {
    logger.error('Failed to get campaign', error);
    res.status(500).json({ error: error?.message || 'Failed to get campaign' });
  }
});

/**
 * PUT /campaigns/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const patch = req.body || {};
    const updated = await campaignRepository.update(req.params.id, {
      title: patch.title,
      description: patch.description,
      targetUrl: patch.targetUrl,
      placements: Array.isArray(patch.placements) ? patch.placements : undefined,
      contentIds: Array.isArray(patch.contentIds) ? patch.contentIds : undefined,
      bid: patch.bid !== undefined ? Number(patch.bid) : undefined,
      totalBudget: patch.totalBudget !== undefined ? Number(patch.totalBudget) : undefined,
      remainingBudget: patch.remainingBudget !== undefined ? Number(patch.remainingBudget) : undefined,
      startAt: patch.startAt ? new Date(patch.startAt) : undefined,
      endAt: patch.endAt ? new Date(patch.endAt) : undefined,
      status: patch.status,
      onChainCampaignId: typeof patch.onChainCampaignId === 'string' ? patch.onChainCampaignId : undefined,
      onChainEscrowId: typeof patch.onChainEscrowId === 'string' ? patch.onChainEscrowId : undefined
    });
    if (!updated) return res.status(404).json({ error: 'Campaign not found' });
    res.json(updated);
  } catch (error: any) {
    logger.error('Failed to update campaign', error);
    res.status(500).json({ error: error?.message || 'Failed to update campaign' });
  }
});

/**
 * POST /campaigns/:id/pause
 */
router.post('/:id/pause', async (req, res) => {
  try {
    const updated = await campaignRepository.setStatus(req.params.id, 'paused');
    if (!updated) return res.status(404).json({ error: 'Campaign not found' });
    res.json(updated);
  } catch (error: any) {
    logger.error('Failed to pause campaign', error);
    res.status(500).json({ error: error?.message || 'Failed to pause campaign' });
  }
});

/**
 * POST /campaigns/:id/resume
 */
router.post('/:id/resume', async (req, res) => {
  try {
    const updated = await campaignRepository.setStatus(req.params.id, 'active');
    if (!updated) return res.status(404).json({ error: 'Campaign not found' });
    res.json(updated);
  } catch (error: any) {
    logger.error('Failed to resume campaign', error);
    res.status(500).json({ error: error?.message || 'Failed to resume campaign' });
  }
});

/**
 * DELETE /campaigns/:id
 * Cancel campaign (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const updated = await campaignRepository.setStatus(req.params.id, 'cancelled');
    if (!updated) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to cancel campaign', error);
    res.status(500).json({ error: error?.message || 'Failed to cancel campaign' });
  }
});

export { router as campaignsRouter };

