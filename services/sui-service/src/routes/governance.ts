/**
 * Governance routes: fetch on-chain GovernanceConfig and proposals.
 *
 * GET /governance/config   – Read GovernanceConfig shared object from SUI chain
 * GET /governance/proposals – Query ProposalCreated events to discover on-chain proposals
 */

import express from 'express';
import { logger } from '../utils/logger';
import { suiClient } from '../sui/client';

const router = express.Router();

// Read env at call time (not import time) so dotenv.config() has run first.
const getGovConfigId = () => process.env.GOVERNANCE_CONFIG_ID || '';
const getPackageId = () => process.env.SUI_PACKAGE_ID || '';

const MIST_PER_SUI = 1_000_000_000;

/** Cached config to avoid hitting RPC on every request. TTL = 60 s. */
let cachedConfig: { data: any; ts: number } | null = null;
const CONFIG_CACHE_TTL = 60_000; // 1 minute

/**
 * Fetch GovernanceConfig from on-chain, with caching.
 * Returns parsed fields or null.
 */
export async function fetchGovernanceConfig(): Promise<Record<string, any> | null> {
  const configId = getGovConfigId();
  if (!configId) return null;

  // Return cache if fresh
  if (cachedConfig && Date.now() - cachedConfig.ts < CONFIG_CACHE_TTL) {
    return cachedConfig.data;
  }

  try {
    const client = suiClient.getClient();
    const result = await client.getObject({
      id: configId,
      options: { showContent: true },
    });

    if (!result?.data?.content || result.data.content.dataType !== 'moveObject') {
      return null;
    }

    const fields = (result.data.content as any).fields;
    if (!fields) return null;

    const parsed = {
      // Raw values (MIST / ms)
      pm_duration_ms: Number(fields.pm_duration_ms ?? 259200000),
      votable_posting_fee: Number(fields.votable_posting_fee ?? 1000000000),
      pm_foundation_pct: Number(fields.pm_foundation_pct ?? 10),
      pm_gateway_pct: Number(fields.pm_gateway_pct ?? 9),
      pm_creator_pct: Number(fields.pm_creator_pct ?? 41),
      pm_pool_pct: Number(fields.pm_pool_pct ?? 40),
      post_foundation_pct: Number(fields.post_foundation_pct ?? 10),
      post_gateway_pct: Number(fields.post_gateway_pct ?? 9),
      post_creator_pct: Number(fields.post_creator_pct ?? 81),
      post_pm_pct: Number(fields.post_pm_pct ?? 0),
      proposal_duration_ms: Number(fields.proposal_duration_ms ?? 604800000),
      quorum_pct: Number(fields.quorum_pct ?? 51),
      last_updated_ms: Number(fields.last_updated_ms ?? 0),
      // Human-friendly derived values
      pmDurationDays: Number(fields.pm_duration_ms ?? 259200000) / (1000 * 60 * 60 * 24),
      votablePostingFeeSui: Number(fields.votable_posting_fee ?? 1000000000) / MIST_PER_SUI,
      proposalDurationDays: Number(fields.proposal_duration_ms ?? 604800000) / (1000 * 60 * 60 * 24),
      // Object metadata
      objectId: configId,
    };

    cachedConfig = { data: parsed, ts: Date.now() };
    return parsed;
  } catch (error) {
    logger.error('Failed to fetch GovernanceConfig', { error });
    return cachedConfig?.data ?? null; // Return stale cache on error
  }
}

/**
 * GET /governance/config
 *
 * Returns the on-chain GovernanceConfig fields (PM duration, votable fee, revenue splits, etc.).
 */
router.get('/config', async (_req, res) => {
  try {
    if (!getGovConfigId()) {
      return res.status(503).json({ error: 'GOVERNANCE_CONFIG_ID not configured' });
    }

    const config = await fetchGovernanceConfig();
    if (!config) {
      return res.status(502).json({ error: 'Failed to read GovernanceConfig from chain' });
    }

    res.json(config);
  } catch (error) {
    logger.error('Error in GET /governance/config', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /governance/proposals
 *
 * Queries ProposalCreated events to discover on-chain governance proposals.
 * Returns array of proposals with param_key, proposer, expires_at, etc.
 */
router.get('/proposals', async (_req, res) => {
  try {
    const packageId = getPackageId();
    if (!packageId) {
      return res.status(503).json({ error: 'SUI_PACKAGE_ID not configured' });
    }

    const client = suiClient.getClient();

    // Query ProposalCreated events from the governance module
    const events = await client.queryEvents({
      query: {
        MoveEventType: `${packageId}::governance::ProposalCreated`,
      },
      limit: 50,
      order: 'descending',
    });

    const proposals = (events.data || []).map((event) => {
      const e = event.parsedJson as any;
      // Decode param_key from byte array if needed
      let paramKey = '';
      if (Array.isArray(e?.param_key)) {
        paramKey = new TextDecoder().decode(new Uint8Array(e.param_key));
      } else if (typeof e?.param_key === 'string') {
        paramKey = e.param_key;
      }

      return {
        proposalId: e?.proposal_id ?? null,
        proposer: e?.proposer ?? '',
        paramKey,
        paramValue: Number(e?.param_value ?? 0),
        splitValues: Array.isArray(e?.split_values) ? e.split_values.map(Number) : [],
        expiresAtMs: Number(e?.expires_at_ms ?? 0),
        expiresAt: e?.expires_at_ms ? new Date(Number(e.expires_at_ms)).toISOString() : null,
        txDigest: event.id?.txDigest ?? null,
        timestamp: event.timestampMs ? new Date(Number(event.timestampMs)).toISOString() : null,
      };
    });

    // Also query ProposalExecuted events to mark which proposals have been executed
    let executedIds: Set<string> = new Set();
    try {
      const execEvents = await client.queryEvents({
        query: {
          MoveEventType: `${packageId}::governance::ProposalExecuted`,
        },
        limit: 50,
        order: 'descending',
      });
      for (const ev of execEvents.data || []) {
        const e = ev.parsedJson as any;
        if (e?.proposal_id) executedIds.add(String(e.proposal_id));
      }
    } catch {
      // ProposalExecuted events may not exist yet
    }

    // Annotate proposals with execution status
    const now = Date.now();
    const annotated = proposals.map((p) => {
      const executed = p.proposalId ? executedIds.has(String(p.proposalId)) : false;
      const expired = p.expiresAtMs > 0 && p.expiresAtMs <= now;
      let status: 'active' | 'expired' | 'executed' = 'active';
      if (executed) status = 'executed';
      else if (expired) status = 'expired';
      return { ...p, executed, status };
    });

    res.json({ proposals: annotated });
  } catch (error) {
    logger.error('Error in GET /governance/proposals', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as governanceRouter, fetchGovernanceConfig as getGovernanceConfig };
