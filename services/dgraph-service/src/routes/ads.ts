import express from 'express';
import axios from 'axios';
import { adEventRepository } from '../repositories/adEventRepository';
import { dgraphClient } from '../dgraph/client';
import { campaignRepository } from '../repositories/campaignRepository';
import { logger } from '../utils/logger';

const router = express.Router();

const ZK_SERVICE_URL = process.env.ZK_SERVICE_URL || 'http://localhost:3010';
const AD_CLICK_THRESHOLD = parseInt(process.env.AD_CLICK_THRESHOLD || '100', 10);
const AD_CONVERSION_THRESHOLD = parseInt(process.env.AD_CONVERSION_THRESHOLD || '25', 10);
const AD_INVENTORY_JSON = process.env.AD_INVENTORY_JSON || '';
const AD_DEFAULT_ENABLED = (process.env.AD_DEFAULT_ENABLED || 'true') === 'true';
const AD_DEFAULT_TITLE = process.env.AD_DEFAULT_TITLE || 'Go Ad-Free with DLUX+';
const AD_DEFAULT_DESCRIPTION = process.env.AD_DEFAULT_DESCRIPTION
  || "Don't watch ads. Support your favorite creators directly with a DLUX subscription.";
const AD_DEFAULT_TARGET_URL = process.env.AD_DEFAULT_TARGET_URL || 'https://dlux.io/subscribe';

type AdInventoryItem = {
  id: string;
  title: string;
  description?: string;
  targetUrl?: string;
  placements?: string[];
  contentIds?: string[];
  startAt?: string;
  endAt?: string;
  active?: boolean;
};

function isValidTargetUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function loadAdInventory(): AdInventoryItem[] {
  if (!AD_INVENTORY_JSON) return [];
  try {
    const parsed = JSON.parse(AD_INVENTORY_JSON);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: AdInventoryItem) => !!item?.id && !!item?.title);
  } catch (error) {
    logger.warn('Failed to parse AD_INVENTORY_JSON', error);
    return [];
  }
}

function buildDefaultAd(): AdInventoryItem | null {
  if (!AD_DEFAULT_ENABLED) return null;
  if (!isValidTargetUrl(AD_DEFAULT_TARGET_URL)) return null;
  return {
    id: 'dlux_subscription_default',
    title: AD_DEFAULT_TITLE,
    description: AD_DEFAULT_DESCRIPTION,
    targetUrl: AD_DEFAULT_TARGET_URL,
    placements: ['gate', 'slip', 'install']
  };
}

function selectActiveAd({
  placement,
  contentId
}: {
  placement?: string;
  contentId?: string;
}): AdInventoryItem | null {
  const inventory = loadAdInventory();
  if (!inventory.length) {
    return buildDefaultAd();
  }

  const now = Date.now();
  const candidates = inventory.filter((item) => {
    if (item.active === false) return false;
    if (!isValidTargetUrl(item.targetUrl)) return false;
    if (placement && Array.isArray(item.placements) && item.placements.length > 0) {
      if (!item.placements.includes(placement)) return false;
    }
    if (contentId && Array.isArray(item.contentIds) && item.contentIds.length > 0) {
      if (!item.contentIds.includes(contentId)) return false;
    }
    if (item.startAt && Date.parse(item.startAt) > now) return false;
    if (item.endAt && Date.parse(item.endAt) < now) return false;
    return true;
  });

  if (!candidates.length) return buildDefaultAd();
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    id: pick.id,
    title: pick.title,
    description: pick.description,
    targetUrl: pick.targetUrl,
    placements: pick.placements,
    contentIds: pick.contentIds
  };
}

async function verifyProof(zkProof: { proof: any; publicSignals: string[] }) {
  try {
    const verifyRes = await axios.post(`${ZK_SERVICE_URL}/proofs/verify`, {
      proof: zkProof.proof,
      publicSignals: zkProof.publicSignals
    });
    return !!verifyRes.data.valid;
  } catch (error) {
    logger.error('Failed to verify ZK proof', error);
    return false;
  }
}

/**
 * GET /ads/active
 * Query params: placement?, contentId?
 */
router.get('/active', (req, res) => {
  try {
    const placement = typeof req.query.placement === 'string' ? req.query.placement : undefined;
    const contentId = typeof req.query.contentId === 'string' ? req.query.contentId : undefined;
    const ad = selectActiveAd({ placement, contentId });
    res.json({ ad });
  } catch (error) {
    logger.error('Failed to select active ad', error);
    res.status(500).json({ error: 'Failed to select active ad' });
  }
});

/**
 * POST /ads/select
 * Select an ad via a simple auction (MVP).
 * Body: { placement, contentId? }
 */
router.post('/select', async (req, res) => {
  try {
    const placement = typeof req.body?.placement === 'string' ? req.body.placement : undefined;
    const contentId = typeof req.body?.contentId === 'string' ? req.body.contentId : undefined;

    if (!placement) {
      return res.status(400).json({ error: 'placement is required' });
    }

    // Prefer active campaigns (highest bid wins).
    const { campaigns } = await campaignRepository.list({ activeOnly: true, placement });
    const now = Date.now();
    const eligible = campaigns
      .filter((c) => c.remainingBudget >= c.bid)
      .filter((c) => !c.startAt || c.startAt.getTime() <= now)
      .filter((c) => !c.endAt || c.endAt.getTime() >= now)
      .filter((c) => {
        if (!contentId) return true;
        if (!Array.isArray(c.contentIds) || c.contentIds.length === 0) return true;
        return c.contentIds.includes(contentId);
      });

    if (eligible.length) {
      const winner = eligible.sort((a, b) => b.bid - a.bid)[0];
      await campaignRepository.spend(winner.id, winner.bid);
      return res.json({
        ad: {
          id: winner.id,
          title: winner.title,
          description: winner.description || '',
          targetUrl: winner.targetUrl,
          bid: winner.bid,
          placement
        }
      });
    }

    // Fallback to static inventory (existing behavior)
    const ad = selectActiveAd({ placement, contentId });
    res.json({ ad });
  } catch (error) {
    logger.error('Failed to select ad', error);
    res.status(500).json({ error: 'Failed to select ad' });
  }
});

/**
 * POST /ads/clicks
 * Record ad click with ZK proof
 */
router.post('/clicks', async (req, res) => {
  try {
    const {
      adId,
      contentId,
      clickTokenHash,
      targetHash,
      zkProof,
      proofHash,
      encryptedViewer,
      blockHeader
    } = req.body;

    if (!adId || !contentId || !clickTokenHash || !targetHash || !zkProof || !proofHash || !encryptedViewer || !blockHeader) {
      return res.status(400).json({ error: 'Missing required fields for click' });
    }

    const isValid = await verifyProof(zkProof);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid ZK proof' });
    }

    const clickId = await adEventRepository.saveClick({
      adId,
      contentId,
      clickTokenHash,
      targetHash,
      zkProof: JSON.stringify(zkProof),
      proofHash,
      encryptedViewer,
      blockHeader,
      verified: true
    });

    const count = await adEventRepository.countClicks(contentId);
    if (count >= AD_CLICK_THRESHOLD) {
      const clicks = await adEventRepository.findClicksByContent(contentId);
      const encryptedImpressions = clicks.map(click => click.encryptedViewer);
      const aggregateRes = await axios.post(`${ZK_SERVICE_URL}/proofs/aggregate`, {
        encryptedImpressions
      });
      await adEventRepository.saveClickAggregate({
        adId,
        contentId,
        encryptedCount: aggregateRes.data.encryptedAggregate,
        threshold: AD_CLICK_THRESHOLD,
        currentCount: clicks.length,
        reachedAt: new Date()
      });
    }

    res.json({ success: true, clickId, count });
  } catch (error) {
    logger.error('Failed to record ad click', error);
    res.status(500).json({ error: 'Failed to record ad click' });
  }
});

/**
 * POST /ads/conversions
 * Record ad conversion with ZK proof
 */
router.post('/conversions', async (req, res) => {
  try {
    const {
      adId,
      contentId,
      clickTokenHash,
      conversionTokenHash,
      zkProof,
      proofHash,
      encryptedViewer,
      blockHeader
    } = req.body;

    if (!adId || !contentId || !clickTokenHash || !conversionTokenHash || !zkProof || !proofHash || !encryptedViewer || !blockHeader) {
      return res.status(400).json({ error: 'Missing required fields for conversion' });
    }

    const isValid = await verifyProof(zkProof);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid ZK proof' });
    }

    const conversionId = await adEventRepository.saveConversion({
      adId,
      contentId,
      clickTokenHash,
      conversionTokenHash,
      zkProof: JSON.stringify(zkProof),
      proofHash,
      encryptedViewer,
      blockHeader,
      verified: true
    });

    const count = await adEventRepository.countConversions(contentId);
    if (count >= AD_CONVERSION_THRESHOLD) {
      const conversions = await adEventRepository.findConversionsByContent(contentId);
      const encryptedImpressions = conversions.map(conv => conv.encryptedViewer);
      const aggregateRes = await axios.post(`${ZK_SERVICE_URL}/proofs/aggregate`, {
        encryptedImpressions
      });
      await adEventRepository.saveConversionAggregate({
        adId,
        contentId,
        encryptedCount: aggregateRes.data.encryptedAggregate,
        threshold: AD_CONVERSION_THRESHOLD,
        currentCount: conversions.length,
        reachedAt: new Date()
      });
    }

    res.json({ success: true, conversionId, count });
  } catch (error) {
    logger.error('Failed to record ad conversion', error);
    res.status(500).json({ error: 'Failed to record ad conversion' });
  }
});

/**
 * GET /ads/clicks/:contentId
 */
router.get('/clicks/:contentId', async (req, res) => {
  try {
    const clicks = await adEventRepository.findClicksByContent(req.params.contentId);
    res.json({ count: clicks.length, clicks: clicks.map(c => ({
      id: c.id,
      adId: c.adId,
      proofHash: c.proofHash,
      timestamp: c.timestamp,
      verified: c.verified
    }))});
  } catch (error) {
    logger.error('Failed to fetch clicks', error);
    res.status(500).json({ error: 'Failed to fetch clicks' });
  }
});

/**
 * GET /ads/click-token/:hash
 * Check if a click token hash exists
 */
router.get('/click-token/:hash', async (req, res) => {
  try {
    const click = await adEventRepository.findClickByTokenHash(req.params.hash);
    res.json({ exists: !!click });
  } catch (error) {
    logger.error('Failed to check click token', error);
    res.status(500).json({ error: 'Failed to check click token' });
  }
});

/**
 * GET /ads/conversions/:contentId
 */
router.get('/conversions/:contentId', async (req, res) => {
  try {
    const conversions = await adEventRepository.findConversionsByContent(req.params.contentId);
    res.json({ count: conversions.length, conversions: conversions.map(c => ({
      id: c.id,
      adId: c.adId,
      proofHash: c.proofHash,
      timestamp: c.timestamp,
      verified: c.verified
    }))});
  } catch (error) {
    logger.error('Failed to fetch conversions', error);
    res.status(500).json({ error: 'Failed to fetch conversions' });
  }
});

/**
 * GET /ads/revenue/:dappId
 * Get total ad revenue for a dApp (from verified impressions and clicks)
 */
router.get('/revenue/:dappId', async (req, res) => {
  try {
    const { dappId } = req.params;

    // Query for ad aggregates related to this dApp
    // In production, this would be more sophisticated with proper revenue calculation
    const query = `
      query adRevenue($dappId: string) {
        aggregates(func: eq(contentId, $dappId)) @filter(type(AdAggregate)) {
          encryptedCount
          merkleRoot
          threshold
          currentCount
          distributed
        }
      }
    `;

    const result = await dgraphClient.query(query, { $dappId: dappId });
    const aggregates = result.aggregates || [];

    // Mock revenue calculation - in production, this would convert verified events to revenue
    // For MVP, assume each verified impression/click bundle = 0.001 SUI
    const totalEvents = aggregates.reduce((sum: number, agg: any) => sum + (agg.currentCount || 0), 0);
    const revenue = totalEvents * 0.001; // Mock conversion rate

    res.json({ total: revenue, events: totalEvents });
  } catch (error) {
    logger.error('Error getting ad revenue', error);
    res.status(500).json({ error: 'Failed to get ad revenue' });
  }
});

/**
 * GET /ads/revenue/owner/:owner
 * Get total ad revenue for all dApps owned by an address
 */
router.get('/revenue/owner/:owner', async (req, res) => {
  try {
    const { owner } = req.params;

    // First get all dApps owned by this address
    const dappQuery = `
      query dapps($owner: string) {
        dapps(func: eq(owner, $owner)) @filter(type(DApp)) {
          id
          name
        }
      }
    `;

    const dappResult = await dgraphClient.query(dappQuery, { $owner: owner });
    const dapps = dappResult.dapps || [];

    let totalRevenue = 0;
    let totalEvents = 0;

    // Sum revenue across all dApps
    for (const dapp of dapps) {
      const revenueQuery = `
        query adRevenue($dappId: string) {
          aggregates(func: eq(contentId, $dappId)) @filter(type(AdAggregate)) {
            currentCount
          }
        }
      `;

      const revenueResult = await dgraphClient.query(revenueQuery, { $dappId: dapp.id });
      const aggregates = revenueResult.aggregates || [];
      const events = aggregates.reduce((sum: number, agg: any) => sum + (agg.currentCount || 0), 0);
      totalEvents += events;
      totalRevenue += events * 0.001; // Mock conversion rate
    }

    res.json({ total: totalRevenue, events: totalEvents });
  } catch (error) {
    logger.error('Error getting owner ad revenue', error);
    res.status(500).json({ error: 'Failed to get owner ad revenue' });
  }
});

export default router;
