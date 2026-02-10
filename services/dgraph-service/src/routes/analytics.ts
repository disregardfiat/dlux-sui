import express from 'express';
import { logger } from '../utils/logger';
import { campaignRepository } from '../repositories/campaignRepository';
import { impressionRepository } from '../repositories/impressionRepository';
import { adEventRepository } from '../repositories/adEventRepository';

const router = express.Router();

function safeRate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

/**
 * GET /analytics/campaign/:id
 */
router.get('/campaign/:id', async (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = await campaignRepository.getById(campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const impressions = await impressionRepository.findByAdId(campaignId);
    const clicks = await adEventRepository.findClicksByAdId(campaignId);
    const conversions = await adEventRepository.findConversionsByAdId(campaignId);

    const impressionCount = impressions.length;
    const clickCount = clicks.length;
    const conversionCount = conversions.length;

    const spend = campaign.totalBudget - campaign.remainingBudget;
    const ctr = safeRate(clickCount, impressionCount);
    const conversionRate = safeRate(conversionCount, clickCount);

    res.json({
      campaignId,
      advertiser: campaign.advertiser,
      impressions: impressionCount,
      clicks: clickCount,
      conversions: conversionCount,
      spend,
      ctr,
      conversionRate
    });
  } catch (error: any) {
    logger.error('Failed to get campaign analytics', error);
    res.status(500).json({ error: error?.message || 'Failed to get campaign analytics' });
  }
});

/**
 * GET /analytics/advertiser/:address
 */
router.get('/advertiser/:address', async (req, res) => {
  try {
    const advertiser = req.params.address;
    const { campaigns } = await campaignRepository.list({ advertiser });

    let impressions = 0;
    let clicks = 0;
    let conversions = 0;
    let spend = 0;

    for (const campaign of campaigns) {
      const campaignImpressions = await impressionRepository.findByAdId(campaign.id);
      const campaignClicks = await adEventRepository.findClicksByAdId(campaign.id);
      const campaignConversions = await adEventRepository.findConversionsByAdId(campaign.id);
      impressions += campaignImpressions.length;
      clicks += campaignClicks.length;
      conversions += campaignConversions.length;
      spend += campaign.totalBudget - campaign.remainingBudget;
    }

    res.json({
      advertiser,
      campaigns: campaigns.length,
      impressions,
      clicks,
      conversions,
      spend,
      ctr: safeRate(clicks, impressions),
      conversionRate: safeRate(conversions, clicks)
    });
  } catch (error: any) {
    logger.error('Failed to get advertiser analytics', error);
    res.status(500).json({ error: error?.message || 'Failed to get advertiser analytics' });
  }
});

/**
 * GET /analytics/platform
 */
router.get('/platform', async (_req, res) => {
  try {
    const { campaigns } = await campaignRepository.list();

    let impressions = 0;
    let clicks = 0;
    let conversions = 0;
    let spend = 0;

    for (const campaign of campaigns) {
      const campaignImpressions = await impressionRepository.findByAdId(campaign.id);
      const campaignClicks = await adEventRepository.findClicksByAdId(campaign.id);
      const campaignConversions = await adEventRepository.findConversionsByAdId(campaign.id);
      impressions += campaignImpressions.length;
      clicks += campaignClicks.length;
      conversions += campaignConversions.length;
      spend += campaign.totalBudget - campaign.remainingBudget;
    }

    res.json({
      campaigns: campaigns.length,
      impressions,
      clicks,
      conversions,
      spend,
      ctr: safeRate(clicks, impressions),
      conversionRate: safeRate(conversions, clicks)
    });
  } catch (error: any) {
    logger.error('Failed to get platform analytics', error);
    res.status(500).json({ error: error?.message || 'Failed to get platform analytics' });
  }
});

export { router as analyticsRouter };

