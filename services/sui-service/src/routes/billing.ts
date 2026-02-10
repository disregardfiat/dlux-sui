import express from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';
import { billingService } from '../services/billingService';

const router = express.Router();

const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';

/**
 * GET /billing/transactions
 * List recent transaction digests for an address (for UI "Recent transactions" / explorer links).
 */
router.get('/transactions', async (req, res) => {
  try {
    const { owner, limit: limitParam } = req.query;
    if (!owner || typeof owner !== 'string') {
      return res.status(400).json({ error: 'owner query parameter is required' });
    }
    const limit = typeof limitParam === 'string' ? Math.min(parseInt(limitParam, 10) || 20, 50) : 20;
    const transactions = await billingService.getTransactionsForAddress(owner, limit);
    res.json({ transactions });
  } catch (error) {
    logger.error('Error getting transactions', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

/**
 * GET /billing/overview
 * Get comprehensive billing overview for an owner
 */
router.get('/overview', async (req, res) => {
  try {
    const { owner } = req.query;

    if (!owner || typeof owner !== 'string') {
      return res.status(400).json({ error: 'owner parameter is required' });
    }

    // Forward auth so DGraph can return full subscription details when owner is the JWT identity
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
    const overview = await billingService.getBillingOverview(owner, authHeader);

    res.json(overview);
  } catch (error) {
    logger.error('Error getting billing overview', error);
    res.status(500).json({ error: 'Failed to get billing overview' });
  }
});

/**
 * POST /billing/claim
 * Claim payouts to a recipient address
 */
router.post('/claim', async (req, res) => {
  try {
    const { owner, buckets, recipientAddress } = req.body;

    if (!owner || !buckets || !Array.isArray(buckets) || !recipientAddress) {
      return res.status(400).json({
        error: 'owner, buckets (array), and recipientAddress are required'
      });
    }

    // Validate buckets
    for (const bucket of buckets) {
      if (!bucket.type || typeof bucket.amount !== 'number') {
        return res.status(400).json({
          error: 'Each bucket must have type and amount fields'
        });
      }
      if (!['adShare', 'subscriptionShare', 'pmShare', 'premiumShare'].includes(bucket.type)) {
        return res.status(400).json({
          error: 'Invalid bucket type. Must be adShare, subscriptionShare, pmShare, or premiumShare'
        });
      }
    }

    // Process claim through billing service
    const result = await billingService.claimPayouts(owner, buckets, recipientAddress);

    res.json(result);
  } catch (error: any) {
    logger.error('Error claiming payouts', error);
    res.status(500).json({
      error: 'Failed to claim payouts',
      details: error.message
    });
  }
});

/**
 * GET /billing/storage/:dappId/:blobId
 * Get storage funding status for a specific dApp blob
 */
router.get('/storage/:dappId/:blobId', async (req, res) => {
  try {
    const { dappId, blobId } = req.params;

    // Get blob billing info from Walrus service
    const walrusResponse = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${blobId}/billing`);
    const blobBilling = walrusResponse.data;

    // Get ad revenue contribution for this blob/dApp
    let adContribution = 0;
    try {
      const adResponse = await axios.get(`${DGRAPH_SERVICE_URL}/ads/revenue/${dappId}`);
      adContribution = adResponse.data.total || 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to get ad revenue for dApp', { dappId, error: message });
    }

    // Get PM fee contribution for this dApp
    let pmContribution = 0;
    try {
      const pmResponse = await axios.get(`${DGRAPH_SERVICE_URL}/markets/fees/${dappId}`);
      pmContribution = pmResponse.data.total || 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to get PM fees for dApp', { dappId, error: message });
    }

    // Calculate funding status
    const termProgressPercent = blobBilling.termProgressPercent;
    const totalFunded = pmContribution + adContribution;
    const coveragePercent = (totalFunded / blobBilling.storageCost) * 100;

    // Determine if ads contribute to storage (only after 50% term progress)
    const adsContributeToStorage = termProgressPercent >= 50;
    const effectiveAdContribution = adsContributeToStorage ? adContribution : 0;

    // Check if precarious (at risk of expiration)
    const isPrecarious = termProgressPercent > 75 && coveragePercent < 100;

    // Check if eligible for auto-renew
    const autoRenewEligible = coveragePercent >= 100;

    res.json({
      dappId,
      blobId,
      ...blobBilling,
      funded: totalFunded,
      coveragePercent: Math.min(coveragePercent, 100),
      pmContribution,
      adContribution: effectiveAdContribution,
      fundingSource: pmContribution > 0 && adContribution > 0 ? 'mixed' :
                   pmContribution > 0 ? 'pm' :
                   adContribution > 0 ? 'ads' : 'manual',
      precarious: isPrecarious,
      autoRenewEligible
    });
  } catch (error) {
    logger.error('Error getting storage funding status', error);
    res.status(500).json({ error: 'Failed to get storage funding status' });
  }
});

/**
 * POST /billing/verify-payment
 * Verify payment transaction for premium content purchases
 */
router.post('/verify-payment', async (req, res) => {
  try {
    const { txId, expectedAmount, expectedRecipient, buyer } = req.body;

    if (!txId || !expectedAmount || !expectedRecipient || !buyer) {
      return res.status(400).json({
        error: 'txId, expectedAmount, expectedRecipient, and buyer are required'
      });
    }

    // In production, this would verify the actual SUI transaction
    // For MVP, we'll do basic validation and assume payment is valid
    const isValid = await billingService.verifyPayment(txId, expectedAmount, expectedRecipient, buyer);

    if (!isValid) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    res.json({ verified: true, txId, amount: expectedAmount });

  } catch (error) {
    logger.error('Error verifying payment', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

/**
 * POST /billing/verify-premium-payment
 * Verify payment for premium content purchases (with platform fee distribution)
 */
router.post('/verify-premium-payment', async (req, res) => {
  try {
    const {
      txId,
      expectedAmount,
      expectedRecipient,
      buyer,
      platformFee,
      foundationAddress,
      creatorShare
    } = req.body;

    if (!txId || !expectedAmount || !expectedRecipient || !buyer ||
        platformFee === undefined || !foundationAddress || creatorShare === undefined) {
      return res.status(400).json({
        error: 'txId, expectedAmount, expectedRecipient, buyer, platformFee, foundationAddress, and creatorShare are required'
      });
    }

    // Verify the main payment transaction
    const isValid = await billingService.verifyPremiumPayment(
      txId,
      expectedAmount,
      expectedRecipient,
      buyer,
      platformFee,
      foundationAddress,
      creatorShare
    );

    if (!isValid) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    res.json({
      verified: true,
      txId,
      amount: expectedAmount,
      creatorShare,
      platformFee,
      foundationAddress
    });

  } catch (error) {
    logger.error('Error verifying premium payment', error);
    res.status(500).json({ error: 'Failed to verify premium payment' });
  }
});

export { router as billingRouter };