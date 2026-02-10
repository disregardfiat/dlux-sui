import express from 'express';
import { logger } from '../utils/logger';
import { suinsService } from '../services/suinsService';
import { vanityService } from '../services/vanityService';

const router = express.Router();

const buildRegistrationUrl = (name?: string, suiAddress?: string): string | null => {
  const baseUrl = process.env.SUINS_REGISTRATION_URL;
  if (!baseUrl) {
    return null;
  }

  const referralCode = process.env.SUINS_REFERRAL_CODE;
  const referralParam = process.env.SUINS_REFERRAL_PARAM || 'ref';
  const url = new URL(baseUrl);

  if (name) {
    url.searchParams.set('name', name);
  }
  if (suiAddress) {
    url.searchParams.set('address', suiAddress);
  }
  if (referralCode) {
    url.searchParams.set(referralParam, referralCode);
  }

  return url.toString();
};

// Check if SuiNS name is available
router.get('/availability/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const available = await suinsService.isAvailable(name);
    if (available === null) {
      return res.status(503).json({ error: 'SuiNS availability check is not configured' });
    }
    res.json({ available, name });
  } catch (error: any) {
    logger.error('Error checking SuiNS availability', error);
    res.status(400).json({ error: error.message || 'Failed to check SuiNS availability' });
  }
});

// Resolve SuiNS name to address
router.get('/resolve/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const address = await suinsService.resolveName(name);
    if (!address) {
      return res.status(404).json({ error: 'SuiNS name not found' });
    }
    res.json({ name, address });
  } catch (error: any) {
    logger.error('Error resolving SuiNS name', error);
    res.status(500).json({ error: error.message || 'Failed to resolve SuiNS name' });
  }
});

// Reverse resolve address to SuiNS name
router.get('/reverse/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const name = await suinsService.reverseResolve(address);
    if (!name) {
      return res.status(404).json({ error: 'SuiNS name not found' });
    }
    res.json({ address, name });
  } catch (error: any) {
    logger.error('Error reverse resolving SuiNS name', error);
    res.status(500).json({ error: error.message || 'Failed to reverse resolve SuiNS name' });
  }
});

// Get profile by identifier (SuiNS name or SUI address)
router.get('/profile/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const user = await vanityService.getUser(identifier);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    logger.error('Error getting SuiNS profile', error);
    res.status(500).json({ error: error.message || 'Failed to get SuiNS profile' });
  }
});

// Update profile by identifier (SuiNS name or SUI address)
router.put('/profile/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { suiAddress, signature, profile } = req.body;

    if (!suiAddress || !signature) {
      return res.status(400).json({ error: 'suiAddress and signature are required' });
    }

    const updated = await vanityService.updateProfile(identifier, suiAddress, signature, profile);
    res.json(updated);
  } catch (error: any) {
    logger.error('Error updating SuiNS profile', error);
    res.status(500).json({ error: error.message || 'Failed to update SuiNS profile' });
  }
});

// Provide registration URL (optional referral support)
router.post('/register-intent', async (req, res) => {
  try {
    const { name, suiAddress } = req.body as { name?: string; suiAddress?: string };
    const registrationUrl = buildRegistrationUrl(name, suiAddress);
    if (!registrationUrl) {
      return res.status(501).json({ error: 'SuiNS registration is not configured' });
    }
    res.json({ registrationUrl });
  } catch (error: any) {
    logger.error('Error building SuiNS registration url', error);
    res.status(500).json({ error: error.message || 'Failed to build SuiNS registration url' });
  }
});

export { router as suinsRouter };
