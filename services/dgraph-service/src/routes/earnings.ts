/**
 * Earnings API - update earnings ledgers (called by settlement services)
 */

import express from 'express';
import { logger } from '../utils/logger';
import { earningsService } from '../services/earningsService';
import { dgraphClient } from '../dgraph/client';

const router = express.Router();

function isDGraphAvailable(): boolean {
  try {
    dgraphClient.getClient();
    return true;
  } catch {
    return false;
  }
}

// POST /earnings/dapp/:dappId/pm - add PM earnings to dApp ledger
router.post('/dapp/:dappId/pm', async (req, res) => {
  try {
    if (!isDGraphAvailable()) {
      return res.status(503).json({ error: 'DGraph unavailable' });
    }

    const { dappId } = req.params;
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    await earningsService.addDAppPMEarnings(dappId, amount);
    logger.info('Updated dApp PM earnings', { dappId, amount });

    res.json({ success: true, dappId, amount });
  } catch (error: any) {
    logger.error('Error updating dApp PM earnings', error);
    res.status(500).json({ error: error.message || 'Failed to update dApp PM earnings' });
  }
});

// POST /earnings/dapp/:dappId/ad - add ad revenue to dApp ledger
router.post('/dapp/:dappId/ad', async (req, res) => {
  try {
    if (!isDGraphAvailable()) {
      return res.status(503).json({ error: 'DGraph unavailable' });
    }

    const { dappId } = req.params;
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    await earningsService.addDAppAdRevenue(dappId, amount);
    logger.info('Updated dApp ad earnings', { dappId, amount });

    res.json({ success: true, dappId, amount });
  } catch (error: any) {
    logger.error('Error updating dApp ad earnings', error);
    res.status(500).json({ error: error.message || 'Failed to update dApp ad earnings' });
  }
});

// POST /earnings/account/:account/pm - add PM earnings to account ledger
router.post('/account/:account/pm', async (req, res) => {
  try {
    if (!isDGraphAvailable()) {
      return res.status(503).json({ error: 'DGraph unavailable' });
    }

    const { account } = req.params;
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    await earningsService.addAccountPMEarnings(account, amount);
    logger.info('Updated account PM earnings', { account, amount });

    res.json({ success: true, account, amount });
  } catch (error: any) {
    logger.error('Error updating account PM earnings', error);
    res.status(500).json({ error: error.message || 'Failed to update account PM earnings' });
  }
});

// POST /earnings/account/:account/ad - add ad revenue to account ledger
router.post('/account/:account/ad', async (req, res) => {
  try {
    if (!isDGraphAvailable()) {
      return res.status(503).json({ error: 'DGraph unavailable' });
    }

    const { account } = req.params;
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    await earningsService.addAccountAdRevenue(account, amount);
    logger.info('Updated account ad earnings', { account, amount });

    res.json({ success: true, account, amount });
  } catch (error: any) {
    logger.error('Error updating account ad earnings', error);
    res.status(500).json({ error: error.message || 'Failed to update account ad earnings' });
  }
});

// GET /earnings/dapp/:dappId - get dApp earnings (rolling window + all-time)
router.get('/dapp/:dappId', async (req, res) => {
  try {
    if (!isDGraphAvailable()) {
      return res.status(503).json({ error: 'DGraph unavailable' });
    }

    const { dappId } = req.params;
    const ledger = await earningsService.getOrCreateDAppLedger(dappId);
    await earningsService.rollBucketsIfNeeded(ledger, 'dapp', dappId);
    
    const updatedLedger = await earningsService.getOrCreateDAppLedger(dappId);
    const rolling = earningsService.getRollingWindowTotals(updatedLedger);
    const allTime = earningsService.getAllTimeTotals(updatedLedger);

    res.json({
      dappId,
      rolling: {
        pmTotal: rolling.pmTotal,
        adTotal: rolling.adTotal,
        windowDays: 90
      },
      allTime: {
        pmTotal: allTime.pmTotal,
        adTotal: allTime.adTotal
      },
      buckets: {
        pm: {
          bucket1: updatedLedger.pmBucket1,
          bucket2: updatedLedger.pmBucket2,
          bucket3: updatedLedger.pmBucket3,
          bucket4: updatedLedger.pmBucket4,
          allTime: updatedLedger.pmAllTime
        },
        ad: {
          bucket1: updatedLedger.adBucket1,
          bucket2: updatedLedger.adBucket2,
          bucket3: updatedLedger.adBucket3,
          bucket4: updatedLedger.adBucket4,
          allTime: updatedLedger.adAllTime
        }
      },
      lastRollDate: updatedLedger.lastRollDate,
      updatedAt: updatedLedger.updatedAt
    });
  } catch (error: any) {
    logger.error('Error getting dApp earnings', error);
    res.status(500).json({ error: error.message || 'Failed to get dApp earnings' });
  }
});

// GET /earnings/account/:account - get account earnings (rolling window + all-time)
router.get('/account/:account', async (req, res) => {
  try {
    if (!isDGraphAvailable()) {
      return res.status(503).json({ error: 'DGraph unavailable' });
    }

    const { account } = req.params;
    const ledger = await earningsService.getOrCreateAccountLedger(account);
    await earningsService.rollBucketsIfNeeded(ledger, 'account', account);
    
    const updatedLedger = await earningsService.getOrCreateAccountLedger(account);
    const rolling = earningsService.getRollingWindowTotals(updatedLedger);
    const allTime = earningsService.getAllTimeTotals(updatedLedger);

    res.json({
      account,
      rolling: {
        pmTotal: rolling.pmTotal,
        adTotal: rolling.adTotal,
        windowDays: 90
      },
      allTime: {
        pmTotal: allTime.pmTotal,
        adTotal: allTime.adTotal
      },
      buckets: {
        pm: {
          bucket1: updatedLedger.pmBucket1,
          bucket2: updatedLedger.pmBucket2,
          bucket3: updatedLedger.pmBucket3,
          bucket4: updatedLedger.pmBucket4,
          allTime: updatedLedger.pmAllTime
        },
        ad: {
          bucket1: updatedLedger.adBucket1,
          bucket2: updatedLedger.adBucket2,
          bucket3: updatedLedger.adBucket3,
          bucket4: updatedLedger.adBucket4,
          allTime: updatedLedger.adAllTime
        }
      },
      lastRollDate: updatedLedger.lastRollDate,
      updatedAt: updatedLedger.updatedAt
    });
  } catch (error: any) {
    logger.error('Error getting account earnings', error);
    res.status(500).json({ error: error.message || 'Failed to get account earnings' });
  }
});

export { router as earningsRouter };
