/**
 * Governance API - platform variables (defaults for MVP)
 */

import express from 'express';
import { logger } from '../utils/logger';
import { earningsService } from '../services/earningsService';

const router = express.Router();
const DEFAULT_VARS = [
  { name: 'foundationShare', value: 0.5, description: 'Revenue to foundation' },
  { name: 'pmFundShare', value: 0.5, description: 'Posting fees to prediction markets' },
  { name: 'maxAnnualChange', value: 0.1, description: 'Max governance change per year' },
];

router.get('/variables', (_req, res) => {
  res.json({ variables: DEFAULT_VARS });
});

router.get('/variables/:name', (req, res) => {
  const v = DEFAULT_VARS.find((x) => x.name === req.params.name);
  if (!v) return res.status(404).json({ error: 'Variable not found' });
  res.json(v);
});

router.get('/markets', (_req, res) => {
  res.json({ markets: [] });
});

router.get('/markets/active', (_req, res) => {
  res.json({ markets: [] });
});

// GET /governance/voter-roll - get current eligible voters
router.get('/voter-roll', async (req, res) => {
  try {
    const voterRoll = await earningsService.getCurrentVoterRoll();
    res.json({
      id: voterRoll.id,
      eligibleVoters: voterRoll.eligibleVoters,
      creatorCount: voterRoll.creatorCount,
      pmEarnerCount: voterRoll.pmEarnerCount,
      threshold: voterRoll.threshold,
      periodStart: voterRoll.periodStart.toISOString(),
      periodEnd: voterRoll.periodEnd.toISOString(),
      computedAt: voterRoll.computedAt.toISOString()
    });
  } catch (error: any) {
    logger.error('Error getting voter roll', error);
    res.status(500).json({ error: error.message || 'Failed to get voter roll' });
  }
});

export { router as governanceRouter };
