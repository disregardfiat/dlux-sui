import express from 'express';
import multer from 'multer';
import { logger } from '../utils/logger';
import { sealClient } from '../seal/client';
import { premiumContentRepository } from '../repositories/premiumContentRepository';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  storage: multer.memoryStorage()
});

const SUI_SERVICE_URL = process.env.SUI_SERVICE_URL || 'http://localhost:3001';
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '0.10'); // 10% platform fee
const MODERATION_ADDRESSES = (process.env.MODERATION_ADDRESSES || '').split(',').filter(addr => addr.trim());

function isModerationAddress(address: string): boolean {
  return MODERATION_ADDRESSES.includes(address.toLowerCase());
}

function calculatePlatformFee(amount: number): { creatorShare: number; platformFee: number } {
  const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT * 100) / 100; // Round to 2 decimal places
  const creatorShare = amount - platformFee;
  return { creatorShare, platformFee };
}

/**
 * POST /premium/content
 * Upload and encrypt premium content
 */
router.post('/content', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { name, description, price, contentType, owner, dappId } = req.body;

    if (!name || !price || !owner || !dappId) {
      return res.status(400).json({
        error: 'name, price, owner, and dappId are required'
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    logger.info('Creating premium content', {
      name,
      size,
      price: parseFloat(price),
      owner,
      dappId
    });

    // Encrypt content with Seal
    const encryptedObject = await sealClient.encryptContent(buffer, owner);

    // Store premium content metadata
    const premiumContent = await premiumContentRepository.create({
      name,
      description: description || '',
      price: parseFloat(price),
      contentType: contentType || mimetype,
      originalSize: size,
      owner,
      dappId,
      sealObjectId: encryptedObject.objectId,
      sealPackage: encryptedObject.sealPackage,
      status: 'active'
    });

    res.json({
      contentId: premiumContent.id,
      sealObjectId: encryptedObject.objectId,
      name: premiumContent.name,
      price: premiumContent.price,
      createdAt: premiumContent.createdAt
    });

  } catch (error) {
    logger.error('Error creating premium content', error);
    res.status(500).json({ error: 'Failed to create premium content' });
  }
});

/**
 * GET /premium/content/:dappId
 * Get all premium content for a dApp
 */
router.get('/content/:dappId', async (req, res) => {
  try {
    const { dappId } = req.params;
    const { user } = req.query; // Optional: check access for specific user

    const contents = await premiumContentRepository.findByDApp(dappId);

    // If user is specified, check access status
    type PremiumContentWithAccess = (typeof contents)[number] & {
      hasAccess?: boolean;
      canPurchase?: boolean;
      isModerator?: boolean;
    };

    let contentsWithAccess: PremiumContentWithAccess[] = contents;
    if (user) {
      const userAddress = user as string;
      const isModerator = isModerationAddress(userAddress);

      contentsWithAccess = await Promise.all(
        contents.map(async (content) => {
          // Moderation accounts have automatic access for safety reviews
          if (isModerator) {
            return {
              ...content,
              hasAccess: true,
              canPurchase: false, // Moderators don't need to purchase
              isModerator: true
            };
          }

          const hasAccess = await sealClient.checkAccess(content.sealObjectId, userAddress);
          return {
            ...content,
            hasAccess,
            canPurchase: !hasAccess
          };
        })
      );
    }

    res.json({
      contents: contentsWithAccess.map((content) => {
        const hasAccess = content.hasAccess === true;
        const canPurchase = typeof content.canPurchase === 'boolean' ? content.canPurchase : !hasAccess;
        return {
          id: content.id,
          name: content.name,
          description: content.description,
          price: content.price,
          contentType: content.contentType,
          createdAt: content.createdAt,
          hasAccess,
          canPurchase
        };
      })
    });

  } catch (error) {
    logger.error('Error fetching premium content', error);
    res.status(500).json({ error: 'Failed to fetch premium content' });
  }
});

/**
 * POST /premium/purchase
 * Purchase access to premium content
 */
router.post('/purchase', async (req, res) => {
  try {
    const { contentId, buyer, paymentTxId } = req.body;

    if (!contentId || !buyer || !paymentTxId) {
      return res.status(400).json({
        error: 'contentId, buyer, and paymentTxId are required'
      });
    }

    // Get premium content
    const content = await premiumContentRepository.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Premium content not found' });
    }

    // Calculate platform fee distribution
    const { creatorShare, platformFee } = calculatePlatformFee(content.price);

    // Get foundation address (this should come from governance variables)
    let foundationAddress = process.env.FOUNDATION_ADDRESS || '0x3d4e565f798ad88b8e99882f37ab1198430c58ff0ecdca70c57cf16bc9fd84ec'; // Default placeholder
    try {
      const governanceResponse = await fetch(`${DGRAPH_SERVICE_URL}/governance/variables`);
      if (governanceResponse.ok) {
        const governance = await governanceResponse.json();
        // Use a configured foundation address or governance-controlled address
        foundationAddress = process.env.FOUNDATION_ADDRESS || '0x3d4e565f798ad88b8e99882f37ab1198430c58ff0ecdca70c57cf16bc9fd84ec';
      }
    } catch (error) {
      logger.warn('Could not fetch governance variables, using default foundation address', error);
    }

    // Verify payment (check with SUI service)
    try {
      const paymentResponse = await fetch(`${SUI_SERVICE_URL}/billing/verify-premium-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId: paymentTxId,
          expectedAmount: content.price,
          expectedRecipient: content.owner,
          buyer,
          platformFee,
          foundationAddress,
          creatorShare
        })
      });

      if (!paymentResponse.ok) {
        return res.status(400).json({ error: 'Payment verification failed' });
      }
    } catch (error) {
      logger.error('Payment verification error', error);
      return res.status(500).json({ error: 'Payment verification failed' });
    }

    // Grant Seal access
    const accessGrant = await sealClient.grantAccess(content.sealObjectId, buyer);

    // Record purchase with fee breakdown
    await premiumContentRepository.recordPurchase({
      contentId,
      buyer,
      paymentTxId,
      accessGrantId: accessGrant.grantId,
      price: content.price,
      creatorShare,
      platformFee,
      foundationAddress
    });

    logger.info('Premium content purchased', {
      contentId,
      buyer,
      price: content.price,
      paymentTxId
    });

    res.json({
      success: true,
      contentId,
      accessGrantId: accessGrant.grantId,
      grantedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error purchasing premium content', error);
    res.status(500).json({ error: 'Failed to purchase premium content' });
  }
});

/**
 * GET /premium/access/:contentId
 * Access premium content (decrypt and serve)
 */
router.get('/access/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { user } = req.query;

    if (!user) {
      return res.status(400).json({ error: 'user parameter required' });
    }

    // Get premium content
    const content = await premiumContentRepository.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Premium content not found' });
    }

    // Check access (moderation accounts have automatic access)
    const userAddress = user as string;
    const isModerator = isModerationAddress(userAddress);
    let hasAccess = isModerator;

    if (!hasAccess) {
      hasAccess = await sealClient.checkAccess(content.sealObjectId, userAddress);
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied. Purchase required.',
        contentId,
        price: content.price,
        isModerator
      });
    }

    // Decrypt and serve content
    const decryptedData = await sealClient.decryptContent(content.sealObjectId, user as string);

    // Set appropriate headers
    res.setHeader('Content-Type', content.contentType);
    res.setHeader('Content-Length', decryptedData.length);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // 1 hour private cache

    res.send(decryptedData);

  } catch (error) {
    logger.error('Error accessing premium content', error);
    res.status(500).json({ error: 'Failed to access premium content' });
  }
});

/**
 * GET /premium/purchases/:user
 * Get user's premium content purchases
 */
router.get('/purchases/:user', async (req, res) => {
  try {
    const { user } = req.params;

    const purchases = await premiumContentRepository.findPurchasesByUser(user);

    res.json({
      purchases: purchases.map(purchase => ({
        id: purchase.id,
        contentId: purchase.contentId,
        contentName: purchase.content?.name,
        price: purchase.price,
        purchasedAt: purchase.purchasedAt,
        accessGrantId: purchase.accessGrantId
      }))
    });

  } catch (error) {
    logger.error('Error fetching user purchases', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

/**
 * DELETE /premium/content/:contentId
 * Remove premium content (owner only)
 */
router.delete('/content/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { owner } = req.query;

    if (!owner) {
      return res.status(400).json({ error: 'owner parameter required' });
    }

    const content = await premiumContentRepository.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (content.owner !== owner) {
      return res.status(403).json({ error: 'Only content owner can delete' });
    }

    // Revoke all access grants
    const purchases = await premiumContentRepository.findPurchasesByContent(contentId);
    for (const purchase of purchases) {
      try {
        await sealClient.revokeAccess(content.sealObjectId, purchase.buyer);
      } catch (error) {
        logger.warn('Failed to revoke access during deletion', { purchaseId: purchase.id, error });
      }
    }

    // Delete content
    await premiumContentRepository.delete(contentId);

    res.json({ success: true, message: 'Premium content deleted' });

  } catch (error) {
    logger.error('Error deleting premium content', error);
    res.status(500).json({ error: 'Failed to delete premium content' });
  }
});

/**
 * GET /premium/earnings/:owner
 * Get total earnings from premium content sales for an owner
 */
router.get('/earnings/:owner', async (req, res) => {
  try {
    const { owner } = req.params;

    // Get all premium content by this owner
    const contents = await premiumContentRepository.findByOwner(owner);

    // Calculate total earnings (creator share only, platform fee goes to foundation)
    let totalEarnings = 0;
    const earningsBreakdown: any[] = [];

    for (const content of contents) {
      const purchases = await premiumContentRepository.findPurchasesByContent(content.id);
      const contentEarnings = purchases.reduce((sum, purchase) => sum + purchase.creatorShare, 0);

      if (contentEarnings > 0) {
        totalEarnings += contentEarnings;
        earningsBreakdown.push({
          contentId: content.id,
          contentName: content.name,
          earnings: contentEarnings,
          purchases: purchases.length
        });
      }
    }

    res.json({
      total: totalEarnings,
      breakdown: earningsBreakdown,
      contentCount: contents.length
    });

  } catch (error) {
    logger.error('Error getting premium earnings', error);
    res.status(500).json({ error: 'Failed to get premium earnings' });
  }
});

export { router as premiumRouter };