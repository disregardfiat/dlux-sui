/**
 * Subscription API - platform-wide ad-free (subscriber pays foundation)
 * POST /subscription - create subscription (subscriber pays foundation)
 * GET /subscription/status - check if subscriber has active platform subscription
 *
 * Revenue: programmatic costs (gas, Walrus, contract/server fees) first, then 90% → ad-share account (creators draw down ad + subscriber share), 10% → foundation.
 * Providers get signed statements (Brave-like): ad statement, subscriber statement. See docs/subscription-foundation-model.md
 */

import express from 'express';
import { logger } from '../utils/logger';
import { dgraphClient } from '../dgraph/client';
import { sameParty } from '../middleware/auth';

const router = express.Router();
const FOUNDATION_ADDRESS = process.env.FOUNDATION_ADDRESS || '0x3d4e565f798ad88b8e99882f37ab1198430c58ff0ecdca70c57cf16bc9fd84ec';

// In-memory fallback when DGraph unavailable (MVP)
// Platform-wide: key = subscriber (one sub per subscriber, recipient = foundation)
const memorySubscriptions = new Map<string, { subscriber: string; recipient: string; tier: string; expiresAt: string; paymentTxId: string }>();

function isDGraphAvailable(): boolean {
  try {
    dgraphClient.getClient();
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /subscription
 * Create subscription: subscriber pays foundation for platform-wide ad-free access.
 * Requires JWT and subscriber must match authenticated identity.
 */
router.post('/', async (req, res) => {
  try {
    const { subscriber, paymentTxId, expiresAt } = req.body;

    if (!subscriber || !paymentTxId) {
      return res.status(400).json({ error: 'subscriber and paymentTxId are required' });
    }
    if (!req.auth || !sameParty(req.auth.suiAddress, subscriber)) {
      return res.status(403).json({ error: 'Must be authenticated as the subscriber to create a subscription' });
    }

    const recipient = FOUNDATION_ADDRESS;
    const exp = expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days default
    const sub = { subscriber, recipient, tier: 'monthly', expiresAt: exp, paymentTxId };

    if (isDGraphAvailable()) {
      try {
        const mutation = {
          set: {
            uid: `_:sub_${subscriber}`,
            dgraph_type: 'Subscription',
            subscriber,
            recipient,
            tier: sub.tier,
            expiresAt: exp,
            paymentTxId,
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        };
        await dgraphClient.mutate(mutation);
      } catch (dgErr) {
        logger.warn('DGraph mutation failed, using memory fallback', dgErr);
        memorySubscriptions.set(subscriber, sub);
      }
    } else {
      memorySubscriptions.set(subscriber, sub);
    }

    logger.info('Subscription created', { subscriber, recipient, tier: sub.tier });
    res.status(201).json({
      success: true,
      subscriber,
      recipient,
      tier: sub.tier,
      expiresAt: exp,
      paymentTxId,
    });
  } catch (error: any) {
    logger.error('Error creating subscription', error);
    res.status(500).json({ error: error.message || 'Failed to create subscription' });
  }
});

/**
 * GET /subscription/status
 * Check if subscriber has active platform subscription (ad-free).
 * Query: ?subscriber=0x...
 * - Without valid JWT as that subscriber: returns only { active: boolean } (no subscription details).
 * - With JWT and subscriber matches identity: returns full response including subscriptions, expiresAt, recipient.
 * - With JWT but subscriber !== identity: 403.
 */
router.get('/status', async (req, res) => {
  try {
    const { subscriber } = req.query;

    if (!subscriber || typeof subscriber !== 'string') {
      return res.status(400).json({ error: 'subscriber query parameter is required' });
    }

    const isOwner = req.auth && sameParty(req.auth.suiAddress, subscriber);
    if (req.auth && !isOwner) {
      return res.status(403).json({ error: 'Can only read your own subscription details' });
    }

    const now = new Date().toISOString();

    if (isDGraphAvailable()) {
      try {
        const query = `
          query status($subscriber: string, $now: string) {
            subs(func: type(Subscription)) @filter(
              eq(subscriber, $subscriber) AND eq(status, "active") AND gt(expiresAt, $now)
            ) {
              subscriber recipient tier expiresAt
            }
          }
        `;
        const result = await dgraphClient.query(query, { $subscriber: subscriber, $now: now });
        const subs = result.subs || [];
        const active = subs.length > 0;
        const latest = subs[0];
        if (!isOwner) {
          return res.json({ active });
        }
        return res.json({
          active,
          subscriptions: subs,
          expiresAt: latest?.expiresAt || null,
          recipient: latest?.recipient || FOUNDATION_ADDRESS,
        });
      } catch (dgErr) {
        logger.warn('DGraph query failed, checking memory', dgErr);
      }
    }

    // Memory fallback
    const sub = memorySubscriptions.get(subscriber);
    const active = !!sub && sub.expiresAt > now;
    if (!isOwner) {
      return res.json({ active });
    }
    return res.json({
      active,
      subscriptions: active ? [sub] : [],
      expiresAt: sub?.expiresAt || null,
      recipient: sub?.recipient || FOUNDATION_ADDRESS,
    });
  } catch (error: any) {
    logger.error('Error getting subscription status', error);
    res.status(500).json({ error: error.message || 'Failed to get subscription status' });
  }
});

export { router as subscriptionRouter };
