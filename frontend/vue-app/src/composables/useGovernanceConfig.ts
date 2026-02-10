/**
 * Composable for fetching the on-chain GovernanceConfig from the SUI service.
 *
 * Returns reactive state: { config, loading, error, refetch }
 *
 * Used by PostDAppView (min fee calculation) and GovernanceView (parameter display).
 */

import { ref, readonly } from 'vue';
import { getSuiServiceUrl } from '@/config/links';

const SUI_SERVICE = getSuiServiceUrl();

/** Shape of the GovernanceConfig returned by GET /governance/config */
export interface GovernanceConfigData {
  // Raw on-chain values
  pm_duration_ms: number;
  votable_posting_fee: number; // MIST
  pm_foundation_pct: number;
  pm_gateway_pct: number;
  pm_creator_pct: number;
  pm_pool_pct: number;
  post_foundation_pct: number;
  post_gateway_pct: number;
  post_creator_pct: number;
  post_pm_pct: number;
  proposal_duration_ms: number;
  quorum_pct: number;
  last_updated_ms: number;
  // Human-friendly derived values
  pmDurationDays: number;
  votablePostingFeeSui: number;
  proposalDurationDays: number;
  objectId: string;
}

/** Shared cache so multiple components don't re-fetch on the same page load. */
let sharedCache: { data: GovernanceConfigData; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

const config = ref<GovernanceConfigData | null>(null);
const loading = ref(false);
const error = ref('');

async function fetchConfig(force = false): Promise<GovernanceConfigData | null> {
  // Return cache if fresh and not forced
  if (!force && sharedCache && Date.now() - sharedCache.ts < CACHE_TTL) {
    config.value = sharedCache.data;
    return sharedCache.data;
  }

  loading.value = true;
  error.value = '';

  try {
    const res = await fetch(`${SUI_SERVICE}/governance/config`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data: GovernanceConfigData = await res.json();
    config.value = data;
    sharedCache = { data, ts: Date.now() };
    return data;
  } catch (err: any) {
    const msg = err?.message || 'Failed to load governance config';
    error.value = msg;
    console.warn('useGovernanceConfig:', msg);
    return null;
  } finally {
    loading.value = false;
  }
}

/**
 * Composable: returns reactive governance config state.
 *
 * Call `refetch()` to force a fresh read from the chain.
 */
export function useGovernanceConfig() {
  // Auto-fetch on first use if not cached
  if (!sharedCache) {
    fetchConfig();
  } else {
    config.value = sharedCache.data;
  }

  return {
    config: readonly(config),
    loading: readonly(loading),
    error: readonly(error),
    refetch: () => fetchConfig(true),
    /** Direct async fetch (useful in setup or before render). */
    fetchConfig,
  };
}
