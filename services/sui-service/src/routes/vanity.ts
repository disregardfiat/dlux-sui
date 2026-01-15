import express from 'express';
import { logger } from '../utils/logger';
import { vanityService } from '../services/vanityService';

const router = express.Router();

// Check if vanity address is available
router.get('/check/:vanity', async (req, res) => {
  try {
    const { vanity } = req.params;
    const available = await vanityService.isAvailable(vanity);
    const price = vanityService.calculatePrice(vanity);
    res.json({ available, vanity, price });
  } catch (error: any) {
    logger.error('Error checking vanity address', error);
    res.status(500).json({ error: error.message || 'Failed to check vanity address' });
  }
});

// Get vanity address info or user by identifier (vanity or SUI address)
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const user = await vanityService.getUser(identifier);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error: any) {
    logger.error('Error getting user', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
});

// Purchase vanity address
router.post('/purchase', async (req, res) => {
  try {
    const { vanity, suiAddress, signature, price } = req.body;
    
    if (!vanity || !suiAddress || !signature) {
      return res.status(400).json({ error: 'Vanity, suiAddress, and signature are required' });
    }
    
    const result = await vanityService.purchase(vanity, suiAddress, signature, price);
    res.json(result);
  } catch (error: any) {
    logger.error('Error purchasing vanity address', error);
    res.status(500).json({ error: error.message || 'Failed to purchase vanity address' });
  }
});

// Update user profile
router.put('/:vanity/profile', async (req, res) => {
  try {
    const { vanity } = req.params;
    const { suiAddress, signature, profile } = req.body;
    
    if (!suiAddress || !signature) {
      return res.status(400).json({ error: 'suiAddress and signature are required' });
    }
    
    const updated = await vanityService.updateProfile(vanity, suiAddress, signature, profile);
    res.json(updated);
  } catch (error: any) {
    logger.error('Error updating profile', error);
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

export { router as vanityRouter };
