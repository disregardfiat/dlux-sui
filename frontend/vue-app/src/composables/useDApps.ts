/**
 * Composable for fetching dApps with PM status and categorization
 */

import { ref } from 'vue';
import axios from 'axios';
import { getSuiServiceUrl, getDgraphServiceUrl } from '@/config/links';
import type { DApp } from '@dlux-sui/types';

const SUI_SERVICE = getSuiServiceUrl();
const DGRAPH_SERVICE = getDgraphServiceUrl();

export interface DAppWithPMStatus extends DApp {
  pmStatus?: {
    overallStatus: 'safe' | 'warning' | 'unsafe' | 'unknown';
    overallColor: 'green' | 'yellow' | 'red' | 'gray';
    hasActiveMarkets: boolean;
    hasResolvedMarkets: boolean;
    lessTested: boolean;
  };
}

/**
 * Fetch dApps and enrich with PM status
 * Uses batching to avoid too many parallel requests
 */
async function fetchDAppsWithPMStatus(limit = 100): Promise<DAppWithPMStatus[]> {
  try {
    // Fetch all dApps
    const response = await axios.get(`${SUI_SERVICE}/dapps`, {
      params: { limit }
    });
    const dapps: DApp[] = response.data.dapps || [];

    // Batch PM status requests (5 at a time to avoid overwhelming the server)
    const batchSize = 5;
    const dappsWithPM: DAppWithPMStatus[] = [];
    
    for (let i = 0; i < dapps.length; i += batchSize) {
      const batch = dapps.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (dapp) => {
          try {
            const safetyRes = await axios.get(`${DGRAPH_SERVICE}/safety/dapp/${encodeURIComponent(dapp.id)}`, {
              timeout: 3000
            });
            const safety = safetyRes.data;
            
            return {
              ...dapp,
              pmStatus: {
                overallStatus: safety.overallStatus || 'unknown',
                overallColor: safety.overallColor || 'gray',
                hasActiveMarkets: (safety.activeMarkets?.length || 0) > 0,
                hasResolvedMarkets: (safety.resolvedMarkets?.length || 0) > 0,
                lessTested: safety.lessTested || false
              }
            } as DAppWithPMStatus;
          } catch (error) {
            // If PM status fetch fails, return dApp with unknown status
            return {
              ...dapp,
              pmStatus: {
                overallStatus: 'unknown',
                overallColor: 'gray',
                hasActiveMarkets: false,
                hasResolvedMarkets: false,
                lessTested: true
              }
            } as DAppWithPMStatus;
          }
        })
      );
      
      // Extract successful results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          dappsWithPM.push(result.value);
        }
      });
    }

    return dappsWithPM;
  } catch (error) {
    console.error('Failed to fetch dApps with PM status:', error);
    return [];
  }
}

/**
 * Get popular dApps (sorted by rating * downloads)
 * Falls back to any dApps if none have ratings/downloads
 */
export async function getPopularDApps(limit = 10): Promise<DAppWithPMStatus[]> {
  const dapps = await fetchDAppsWithPMStatus(100);
  
  if (dapps.length === 0) return [];
  
  // Sort by popularity score (rating * downloads)
  const withScores = dapps.filter(d => (d.rating || 0) > 0 && (d.downloadCount || 0) > 0);
  
  if (withScores.length > 0) {
    const sorted = withScores.sort((a, b) => {
      const scoreA = (a.rating || 0) * (a.downloadCount || 0);
      const scoreB = (b.rating || 0) * (b.downloadCount || 0);
      return scoreB - scoreA;
    });
    return sorted.slice(0, limit);
  }
  
  // Fallback: return most recent dApps if none have scores
  return dapps
    .sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return dateB - dateA;
    })
    .slice(0, limit);
}

/**
 * Get featured dApps (high rating, resolved PMs, or curated)
 */
export async function getFeaturedDApps(limit = 10): Promise<DAppWithPMStatus[]> {
  const dapps = await fetchDAppsWithPMStatus(100);
  
  // Featured: high rating + resolved PMs (safe)
  const featured = dapps
    .filter(d => {
      const hasResolved = d.pmStatus?.hasResolvedMarkets;
      const isSafe = d.pmStatus?.overallStatus === 'safe';
      const highRating = (d.rating || 0) >= 4.0;
      return (hasResolved && isSafe) || highRating;
    })
    .sort((a, b) => {
      // Prioritize resolved + safe
      const aFeatured = a.pmStatus?.hasResolvedMarkets && a.pmStatus?.overallStatus === 'safe' ? 1 : 0;
      const bFeatured = b.pmStatus?.hasResolvedMarkets && b.pmStatus?.overallStatus === 'safe' ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;
      // Then by rating
      return (b.rating || 0) - (a.rating || 0);
    });
  
  return featured.slice(0, limit);
}

/**
 * Get new dApps with PM resolved (safe, tested)
 */
export async function getNewDAppsResolved(limit = 10): Promise<DAppWithPMStatus[]> {
  const dapps = await fetchDAppsWithPMStatus(100);
  
  // New + PM resolved = recently created with resolved markets
  const newResolved = dapps
    .filter(d => {
      const hasResolved = d.pmStatus?.hasResolvedMarkets;
      const isSafe = d.pmStatus?.overallStatus === 'safe';
      const createdAt = d.createdAt instanceof Date ? d.createdAt : (d.createdAt ? new Date(d.createdAt) : null);
      const isNew = createdAt && createdAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000; // Last 7 days
      return isNew && hasResolved && isSafe;
    })
    .sort((a, b) => {
      // Sort by creation date (newest first)
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return dateB - dateA;
    });
  
  return newResolved.slice(0, limit);
}

/**
 * Get dangerously new dApps (PM not resolved - untested)
 */
export async function getDangerouslyNewDApps(limit = 10): Promise<DAppWithPMStatus[]> {
  const dapps = await fetchDAppsWithPMStatus(100);
  
  // Dangerously new = recently created, no resolved PMs, possibly active markets
  const dangerouslyNew = dapps
    .filter(d => {
      const hasResolved = d.pmStatus?.hasResolvedMarkets;
      const hasActive = d.pmStatus?.hasActiveMarkets;
      const lessTested = d.pmStatus?.lessTested;
      const createdAt = d.createdAt instanceof Date ? d.createdAt : (d.createdAt ? new Date(d.createdAt) : null);
      const isNew = createdAt && createdAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000; // Last 7 days
      return isNew && !hasResolved && (hasActive || lessTested);
    })
    .sort((a, b) => {
      // Sort by creation date (newest first)
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return dateB - dateA;
    });
  
  return dangerouslyNew.slice(0, limit);
}

/**
 * Get trending dApps (mix of popular, featured, new)
 * Falls back to any available dApps if categories are empty
 */
export async function getTrendingDApps(limit = 10): Promise<DAppWithPMStatus[]> {
  // First, try to get any dApps at all (fast path)
  try {
    console.log(`[getTrendingDApps] Fetching dApps from ${SUI_SERVICE}/dapps`);
    const response = await axios.get(`${SUI_SERVICE}/dapps`, {
      params: { limit: limit * 2 },
      timeout: 10000
    });
    const allDAppsRaw: DApp[] = response.data.dapps || [];
    
    console.log(`[getTrendingDApps] Found ${allDAppsRaw.length} dApps`);
    
    if (allDAppsRaw.length === 0) {
      console.warn('[getTrendingDApps] No dApps found in API response');
      return [];
    }
    
    // If we have dApps, try to get PM status for them (but don't fail if PM fetch fails)
    console.log(`[getTrendingDApps] Enriching ${Math.min(allDAppsRaw.length, limit)} dApps with PM status`);
    const dappsWithPM = await Promise.allSettled(
      allDAppsRaw.slice(0, limit).map(async (dapp) => {
        try {
          const safetyRes = await axios.get(`${DGRAPH_SERVICE}/safety/dapp/${encodeURIComponent(dapp.id)}`, {
            timeout: 3000
          });
          const safety = safetyRes.data;
          return {
            ...dapp,
            pmStatus: {
              overallStatus: safety.overallStatus || 'unknown',
              overallColor: safety.overallColor || 'gray',
              hasActiveMarkets: (safety.activeMarkets?.length || 0) > 0,
              hasResolvedMarkets: (safety.resolvedMarkets?.length || 0) > 0,
              lessTested: safety.lessTested || false
            }
          } as DAppWithPMStatus;
        } catch (pmError) {
          console.debug(`[getTrendingDApps] PM fetch failed for dApp ${dapp.id}, using default status`);
          // Return dApp without PM status if fetch fails
          return {
            ...dapp,
            pmStatus: {
              overallStatus: 'unknown' as const,
              overallColor: 'gray' as const,
              hasActiveMarkets: false,
              hasResolvedMarkets: false,
              lessTested: true
            }
          } as DAppWithPMStatus;
        }
      })
    );
    
    const result = dappsWithPM
      .filter((r): r is PromiseFulfilledResult<DAppWithPMStatus> => r.status === 'fulfilled')
      .map(r => r.value);
    
    console.log(`[getTrendingDApps] Returning ${result.length} dApps`);
    
    // Sort by creation date (newest first) if we don't have ratings
    return result.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return dateB - dateA;
    }).slice(0, limit);
  } catch (error) {
    console.error('[getTrendingDApps] Failed to fetch trending dApps:', error);
    if (axios.isAxiosError(error)) {
      console.error(`[getTrendingDApps] API Error: ${error.message}, URL: ${error.config?.url}`);
    }
    return [];
  }
}

export function useDApps() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  return {
    loading,
    error,
    getPopularDApps,
    getFeaturedDApps,
    getNewDAppsResolved,
    getDangerouslyNewDApps,
    getTrendingDApps
  };
}
