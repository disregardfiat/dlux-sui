import express from 'express';
import { SUIdApp } from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { dappRepository } from '../repositories/dappRepository';
import { authService } from '../services/authService';
import { suinsService } from '../services/suinsService';
import { profileService } from '../services/profileService';
import { getGovernanceConfig } from './governance';

const router = express.Router();
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';

// UPDATE_LOCK_MS matches the contract constant (3 days = 259200000 ms)
// No metadata updates allowed during this period while PM is active
const UPDATE_LOCK_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

/** LRU cache for resolved Walrus manifests to avoid repeated network round-trips. */
const walrusManifestCache = new Map<string, { data: any; ts: number }>();
const MANIFEST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MANIFEST_CACHE_MAX = 500;

/** Cache for owner address → SuiNS name (reverse resolve). */
const ownerSuinsCache = new Map<string, { name: string | null; ts: number }>();
const SUINS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const SUINS_CACHE_MAX = 500;

/** Cache for owner address → profile avatar URL (for dApp cards). */
const ownerAvatarCache = new Map<string, { avatar: string | null; ts: number }>();
const AVATAR_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const AVATAR_CACHE_MAX = 500;

/** Best-effort reverse-resolve an owner address to SuiNS name (cached). */
async function resolveOwnerSuins(address: string): Promise<string | null> {
  if (!address || !address.startsWith('0x')) return null;
  const key = address.toLowerCase();
  const cached = ownerSuinsCache.get(key);
  if (cached && Date.now() - cached.ts < SUINS_CACHE_TTL) return cached.name;
  try {
    const name = await suinsService.reverseResolve(address);
    if (ownerSuinsCache.size >= SUINS_CACHE_MAX) {
      const oldest = ownerSuinsCache.keys().next().value;
      if (oldest) ownerSuinsCache.delete(oldest);
    }
    ownerSuinsCache.set(key, { name, ts: Date.now() });
    return name;
  } catch {
    return null;
  }
}

/** DNS-safe subdomain: prefer SuiNS name (e.g. "disregardfiat"), fall back to "h" + hex. */
async function ownerSubdomain(addr: string): Promise<string> {
  const suins = await resolveOwnerSuins(addr);
  if (suins) return suins.replace(/\.sui$/, '');
  const normalized = (addr || '').toLowerCase().replace(/^0x/, '');
  const hex = normalized.replace(/[^a-f0-9]/g, '').slice(0, 62);
  return hex ? `h${hex}` : '';
}

/** Synchronous fallback – hex subdomain only (for use in bulk listing). */
function addressSubdomain(addr: string): string {
  const normalized = (addr || '').toLowerCase().replace(/^0x/, '');
  const hex = normalized.replace(/[^a-f0-9]/g, '').slice(0, 62);
  return hex ? `h${hex}` : '';
}

/** Enrich a single dApp with ownerSuinsName, subdomain, and ownerAvatar (async, best-effort). */
async function enrichDapp(dapp: SUIdApp): Promise<any> {
  const suins = await resolveOwnerSuins(dapp.owner);
  const subdomain = suins ? suins.replace(/\.sui$/, '') : addressSubdomain(dapp.owner);
  let ownerAvatar: string | undefined;
  const avatarKey = (dapp.owner || '').toLowerCase();
  const cachedAvatar = ownerAvatarCache.get(avatarKey);
  if (cachedAvatar && Date.now() - cachedAvatar.ts < AVATAR_CACHE_TTL) {
    ownerAvatar = cachedAvatar.avatar ?? undefined;
  } else {
    try {
      const user = await profileService.getUser(dapp.owner);
      const avatar = user?.profile?.avatar;
      if (ownerAvatarCache.size >= AVATAR_CACHE_MAX) {
        const oldest = ownerAvatarCache.keys().next().value;
        if (oldest) ownerAvatarCache.delete(oldest);
      }
      ownerAvatarCache.set(avatarKey, { avatar: avatar ?? null, ts: Date.now() });
      ownerAvatar = avatar ?? undefined;
    } catch {
      ownerAvatar = undefined;
    }
  }
  return { ...dapp, ownerSuinsName: suins || undefined, subdomain, ownerAvatar };
}

/** Enrich a batch of dApps (deduplicates owner lookups). */
async function enrichDapps(dapps: SUIdApp[]): Promise<any[]> {
  // Pre-populate cache for unique owners in parallel
  const owners = [...new Set(dapps.map(d => d.owner).filter(Boolean))];
  await Promise.allSettled(owners.map(o => resolveOwnerSuins(o)));
  return Promise.all(dapps.map(d => enrichDapp(d)));
}

/** Resolve manifest on read when stored as walrus:blobId (e.g. dApps indexed before we stored resolved manifest). */
async function resolveManifestIfWalrus(dapp: SUIdApp): Promise<SUIdApp> {
  const raw = (dapp as any).manifest;
  if (typeof raw !== 'string' || !raw.startsWith('walrus:')) return dapp;
  const blobId = raw.slice(7).trim();
  if (!blobId) return dapp;

  // Check cache first
  const cached = walrusManifestCache.get(blobId);
  if (cached && Date.now() - cached.ts < MANIFEST_CACHE_TTL) {
    return { ...dapp, manifest: cached.data };
  }

  try {
    const axios = require('axios');
    const res = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(blobId)}`, {
      responseType: 'arraybuffer',
      timeout: 10000,
      validateStatus: () => true
    });
    if (res.status === 200) {
      const text = new TextDecoder().decode(res.data);
      let manifest: any;
      try {
        manifest = JSON.parse(text);
      } catch {
        manifest = {};
      }

      // Cache the result
      if (walrusManifestCache.size >= MANIFEST_CACHE_MAX) {
        const oldestKey = walrusManifestCache.keys().next().value;
        if (oldestKey) walrusManifestCache.delete(oldestKey);
      }
      walrusManifestCache.set(blobId, { data: manifest, ts: Date.now() });

      return { ...dapp, manifest };
    }
  } catch (err) {
    logger.warn('Resolve manifest on read failed', { blobId, error: err });
  }
  return dapp;
}

// Lookup dApp by owner + permlink (for sandbox overlays)
// author: SuiNS name (alice.sui) or SUI address (0x...)
router.get('/lookup', async (req, res) => {
  try {
    const { author, permlink } = req.query;
    if (!author || !permlink || typeof author !== 'string' || typeof permlink !== 'string') {
      return res.status(400).json({ error: 'author and permlink are required' });
    }

    let owner = author;
    if (!author.startsWith('0x')) {
      const resolved = await suinsService.resolveName(author);
      if (resolved) owner = resolved;
    }

    // Query DGraph for dApp by owner and permlink
    const dapps = await getDAppsByOwnerFromDGraph(owner, 100, 0, permlink);
    let dapp = dapps.length > 0 ? dapps[0] : null;
    
    // Fallback to in-memory if not found in DGraph
    if (!dapp) {
      dapp = await dappRepository.findByOwnerAndPermlink(owner, permlink);
    }
    
    if (!dapp) {
      return res.status(404).json({ error: 'dApp not found' });
    }
    dapp = await resolveManifestIfWalrus(dapp);

    const labels = Array.isArray((dapp as any).manifest?.metadata?.labels)
      ? (dapp as any).manifest.metadata.labels
      : [];

    const enriched = await enrichDapp(dapp);
    res.json({
      ...enriched,
      tags: dapp.tags || [],
      category: (dapp as any).category || null,
      labels,
      blobIds: dapp.blobIds || [],
      manifest: (dapp as any).manifest || null
    });
  } catch (error) {
    logger.error('Error looking up dApp', { error });
    res.status(500).json({ error: 'Failed to lookup dApp' });
  }
});

// Get dApps by owner
router.get('/owner/:suiAddress', async (req, res) => {
  try {
    const { suiAddress } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const dapps = await getDAppsByOwnerFromDGraph(suiAddress, limit + offset, 0);
    const paginated = dapps.slice(offset, offset + limit);
    const enriched = await enrichDapps(paginated);

    res.json({
      dapps: enriched,
      total: dapps.length,
      limit,
      offset
    });

  } catch (error) {
    logger.error('Error getting dApps by owner', { suiAddress: req.params.suiAddress, error });
    res.status(500).json({ error: 'Failed to get dApps' });
  }
});

/** Search dApps from DGraph with filters (query, tags, category, license). */
async function searchDAppsFromDGraph(params: {
  query?: string;
  tags?: string[];
  category?: string;
  license?: string;
  limit?: number;
  offset?: number;
}): Promise<{ dapps: SUIdApp[]; total: number; hasMore: boolean }> {
  try {
    const axios = require('axios');
    const { query, tags, category, license, limit = 50, offset = 0 } = params;

    // Build search query - use searchDApps which supports query, category, and tags
    const graphqlQuery = `
      query searchDApps($query: String, $category: DAppCategory, $tags: [String!], $limit: Int, $offset: Int) {
        searchDApps(query: $query, category: $category, tags: $tags, limit: $limit, offset: $offset) {
          dapps {
            id
            name
            description
            owner
            permlink
            version
            manifest {
              entryPoint
              assets
              dependencies
              permissions
              pathMap
              metadata {
                title
                description
                author
                version
                license
                thumbnail
              }
            }
            blobIds
            tags
            createdAt
            updatedAt
          }
          total
          hasMore
        }
      }
    `;

    // Map category string to enum if provided
    let categoryEnum: string | undefined = undefined;
    if (category) {
      categoryEnum = category.toUpperCase();
    }

    const response = await axios.post(`${DGRAPH_SERVICE_URL}/graphql`, {
      query: graphqlQuery,
      variables: { 
        query, 
        category: categoryEnum, 
        tags: tags || undefined, 
        limit, 
        offset 
      }
    }, {
      timeout: 5000,
      validateStatus: () => true
    });

    if (response.status !== 200 || response.data.errors) {
      throw new Error(`DGraph search failed: ${JSON.stringify(response.data.errors || response.status)}`);
    }

    const result = response.data.data?.searchDApps || { dapps: [], total: 0, hasMore: false };
    const dapps = result.dapps || [];

    // Filter by license if specified (since GraphQL doesn't support license filter yet)
    let filteredDapps = dapps;
    if (license) {
      filteredDapps = dapps.filter((d: any) => {
        const manifestLicense = d.manifest?.metadata?.license || '';
        return manifestLicense.toLowerCase().includes(license.toLowerCase());
      });
    }

    return {
      dapps: filteredDapps.map((d: any) => {
        let manifest = d.manifest || {};
        if (typeof manifest === 'string') {
          try {
            manifest = JSON.parse(manifest);
          } catch {
            manifest = {};
          }
        }
        
        return {
          id: d.id,
          name: d.name,
          description: d.description || '',
          owner: d.owner,
          permlink: d.permlink || d.id.split(':').pop() || d.id,
          version: d.version || '1.0.0',
          manifest,
          blobIds: d.blobIds || [],
          tags: d.tags || [],
          createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
          updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date()
        };
      }),
      total: license ? filteredDapps.length : result.total,
      hasMore: license ? false : result.hasMore
    };
  } catch (error) {
    logger.warn('Failed to search dApps from DGraph, falling back to in-memory', { params, error });
    // Fallback to in-memory search
    let dapps: SUIdApp[] = [];
    if (params.query) {
      dapps = await dappRepository.search(params.query);
    } else if (params.tags) {
      dapps = await dappRepository.findByTags(params.tags);
    }
    return { dapps, total: dapps.length, hasMore: false };
  }
}

// Search dApps
router.get('/search', async (req, res) => {
  try {
    const { q: query, tags, category, license } = req.query;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!query && !tags && !category && !license) {
      return res.status(400).json({ error: 'Search query, tags, category, or license is required' });
    }

    const tagsArray = tags 
      ? (Array.isArray(tags) ? tags as string[] : [tags as string])
      : undefined;

    const result = await searchDAppsFromDGraph({
      query: query as string | undefined,
      tags: tagsArray,
      category: category as string | undefined,
      license: license as string | undefined,
      limit,
      offset
    });

    const enriched = await enrichDapps(result.dapps);
    res.json({
      dapps: enriched,
      total: result.total,
      hasMore: result.hasMore,
      query: query || tags || category || license
    });

  } catch (error) {
    logger.error('Error searching dApps', { query: req.query.q, tags: req.query.tags, error });
    res.status(500).json({ error: 'Search failed' });
  }
});

/** Query a single dApp - try DGraph first, but always fallback to in-memory. */
async function getDAppByIdFromDGraph(id: string): Promise<SUIdApp | null> {
  // Try in-memory first (it's the immediate cache)
  const inMemoryDapp = await dappRepository.findById(id);
  if (inMemoryDapp) {
    return inMemoryDapp;
  }

  // If not in memory, try DGraph
  try {
    const axios = require('axios');
    const query = `
      query dapp($id: ID!) {
        dapp(id: $id) {
          id
          name
          description
          owner
          permlink
          version
          manifest {
            entryPoint
            assets
            dependencies
            permissions
            pathMap
            metadata {
              title
              description
              author
              version
              license
              thumbnail
            }
          }
          blobIds
          tags
          createdAt
          updatedAt
        }
      }
    `;

    const response = await axios.post(`${DGRAPH_SERVICE_URL}/graphql`, {
      query,
      variables: { id }
    }, {
      timeout: 3000,
      validateStatus: () => true
    });

    if (response.status === 200 && !response.data.errors && response.data.data?.dapp) {
      const dapp = response.data.data.dapp;
      let manifest = dapp.manifest || {};
      if (typeof manifest === 'string') {
        try {
          manifest = JSON.parse(manifest);
        } catch {
          manifest = {};
        }
      }

      return {
        id: dapp.id,
        name: dapp.name,
        description: dapp.description || '',
        owner: dapp.owner,
        permlink: dapp.permlink || dapp.id.split(':').pop() || dapp.id,
        version: dapp.version || '1.0.0',
        manifest,
        blobIds: dapp.blobIds || [],
        tags: dapp.tags || [],
        createdAt: dapp.createdAt ? new Date(dapp.createdAt) : new Date(),
        updatedAt: dapp.updatedAt ? new Date(dapp.updatedAt) : new Date()
      };
    }
  } catch (error) {
    logger.debug('DGraph query failed (non-critical)', { id, error });
  }

  return null;
}

/** Query dApps by owner - try in-memory first, then DGraph. */
async function getDAppsByOwnerFromDGraph(owner: string, limit: number, offset: number, permlink?: string): Promise<SUIdApp[]> {
  // Try in-memory first
  let inMemoryDapps: SUIdApp[] = [];
  if (permlink) {
    const dapp = await dappRepository.findByOwnerAndPermlink(owner, permlink);
    if (dapp) inMemoryDapps = [dapp];
  } else {
    inMemoryDapps = await dappRepository.findByOwner(owner);
  }

  if (inMemoryDapps.length > 0) {
    return inMemoryDapps;
  }

  // If not in memory, try DGraph
  try {
    const axios = require('axios');
    const query = `
      query dapps($owner: String, $limit: Int, $offset: Int) {
        dapps(owner: $owner, limit: $limit, offset: $offset) {
          id
          name
          description
          owner
          permlink
          version
          manifest {
            entryPoint
            assets
            dependencies
            permissions
            pathMap
            metadata {
              title
              description
              author
              version
              license
              thumbnail
            }
          }
          blobIds
          tags
          createdAt
          updatedAt
        }
      }
    `;

    const response = await axios.post(`${DGRAPH_SERVICE_URL}/graphql`, {
      query,
      variables: { owner, limit, offset }
    }, {
      timeout: 3000,
      validateStatus: () => true
    });

    if (response.status === 200 && !response.data.errors && response.data.data?.dapps) {
      let dapps = response.data.data.dapps || [];
      
      // Filter by permlink if provided
      if (permlink) {
        dapps = dapps.filter((d: any) => d.permlink === permlink);
      }
      
      return dapps.map((d: any) => {
        let manifest = d.manifest || {};
        if (typeof manifest === 'string') {
          try {
            manifest = JSON.parse(manifest);
          } catch {
            manifest = {};
          }
        }
        
        return {
          id: d.id,
          name: d.name,
          description: d.description || '',
          owner: d.owner,
          permlink: d.permlink || d.id.split(':').pop() || d.id,
          version: d.version || '1.0.0',
          manifest,
          blobIds: d.blobIds || [],
          tags: d.tags || [],
          createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
          updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date()
        };
      });
    }
  } catch (error) {
    logger.debug('DGraph query failed (non-critical)', { owner, permlink, error });
  }

  return [];
}

/** Query dApps - try DGraph first, but always fallback to in-memory (which is primary cache). */
async function getDAppsFromDGraph(limit: number, offset: number): Promise<SUIdApp[]> {
  // Try DGraph first, but if it fails or returns empty, use in-memory
  let dgraphDapps: SUIdApp[] = [];
  try {
    const axios = require('axios');
    const graphqlQuery = `
      query dapps($limit: Int, $offset: Int) {
        dapps(limit: $limit, offset: $offset) {
          id
          name
          description
          owner
          permlink
          version
          manifest {
            entryPoint
            assets
            dependencies
            permissions
            pathMap
            metadata {
              title
              description
              author
              version
              license
              thumbnail
            }
          }
          blobIds
          tags
          createdAt
          updatedAt
        }
      }
    `;

    const response = await axios.post(`${DGRAPH_SERVICE_URL}/graphql`, {
      query: graphqlQuery,
      variables: { limit, offset }
    }, {
      timeout: 3000, // Shorter timeout - fail fast
      validateStatus: () => true
    });

    if (response.status === 200 && !response.data.errors && response.data.data?.dapps) {
      dgraphDapps = (response.data.data.dapps || []).map((d: any) => {
        let manifest = d.manifest || {};
        if (typeof manifest === 'string') {
          try {
            manifest = JSON.parse(manifest);
          } catch {
            manifest = {};
          }
        }
        
        return {
          id: d.id,
          name: d.name,
          description: d.description || '',
          owner: d.owner,
          permlink: d.permlink || d.id.split(':').pop() || d.id,
          version: d.version || '1.0.0',
          manifest,
          blobIds: d.blobIds || [],
          tags: d.tags || [],
          createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
          updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date()
        };
      });
    }
  } catch (error) {
    logger.debug('DGraph query failed (non-critical), using in-memory', { error });
  }

  // Always check in-memory as primary source (it's the immediate cache)
  const inMemoryDapps = await dappRepository.findAll(limit, offset);
  
  // If DGraph has data, merge/prioritize it, otherwise use in-memory
  // For now, prefer in-memory if it has data (it's more up-to-date), otherwise use DGraph
  if (inMemoryDapps.length > 0) {
    return inMemoryDapps;
  }
  
  // If in-memory is empty but DGraph has data, use DGraph
  return dgraphDapps;
}

// Get all dApps (paginated) - reads from DGraph (source of truth)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const dapps = await getDAppsFromDGraph(limit, offset);
    const enriched = await enrichDapps(dapps);

    res.json({
      dapps: enriched,
      limit,
      offset
    });

  } catch (error) {
    logger.error('Error getting dApps', error);
    res.status(500).json({ error: 'Failed to get dApps' });
  }
});

router.post('/:id/install/challenge', async (req, res) => {
  try {
    const { suiAddress } = req.body;
    if (!suiAddress) {
      return res.status(400).json({ error: 'suiAddress is required' });
    }
    const challenge = await authService.generateChallenge(suiAddress);
    res.json({
      challengeId: challenge.id,
      challenge: challenge.challenge,
      expiresAt: challenge.expiresAt
    });
  } catch (error) {
    logger.error('Failed to generate install challenge', { error });
    res.status(500).json({ error: 'Failed to generate install challenge' });
  }
});

router.post('/:id/install', async (req, res) => {
  try {
    const { id: dappId } = req.params;
    const { suiAddress, signature, challengeId, installId, platform, userAgent, subscription } = req.body || {};

    if (!suiAddress || !signature || !challengeId || !installId) {
      return res.status(400).json({
        error: 'suiAddress, signature, challengeId, and installId are required'
      });
    }

    const validChallenge = await authService.verifyChallenge(challengeId, suiAddress);
    if (!validChallenge) {
      return res.status(401).json({ error: 'Invalid or expired challenge' });
    }

    const challengeText = authService.getChallengeText(challengeId);
    if (!challengeText) {
      return res.status(401).json({ error: 'Challenge text not found' });
    }
    const validSignature = await authService.verifySignature(suiAddress, signature, challengeText);
    if (!validSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    authService.consumeChallenge(challengeId);

    const axios = require('axios');
    const response = await axios.post(`${DGRAPH_SERVICE_URL}/installs/dapps/${dappId}`, {
      installId,
      suiAddress,
      platform,
      userAgent,
      subscription
    });

    res.json({
      success: true,
      ...response.data
    });
  } catch (error: any) {
    logger.error('Failed to record install', { error });
    res.status(500).json({ error: 'Failed to record install' });
  }
});

// Get dApp by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let dapp = await getDAppByIdFromDGraph(id);

    if (!dapp) {
      return res.status(404).json({ error: 'dApp not found' });
    }
    dapp = await resolveManifestIfWalrus(dapp);

    const payload = await enrichDapp(dapp);
    res.json(payload);

  } catch (error) {
    logger.error('Error getting dApp', { id: req.params.id, error });
    res.status(500).json({ error: 'Failed to get dApp' });
  }
});

// Build on-chain dApp posting transaction (for wallets and E2E tests).
// Returns serialized transaction bytes; caller signs and submits to SUI.
router.post('/build-tx', async (req, res) => {
  try {
    const packageId = process.env.SUI_PACKAGE_ID;
    if (!packageId) {
      return res.status(503).json({ error: 'SUI_PACKAGE_ID not configured - on-chain posting not available' });
    }

    const { Transaction } = require('@mysten/sui/transactions');
    const { SuiClient } = require('@mysten/sui/client');
    const { bcs } = require('@mysten/sui/bcs');

    const {
      sender, name, description, permlink, version,
      manifest, blobIds, tags, category, postingFeeSui
    } = req.body;

    if (!sender || !name || !permlink) {
      return res.status(400).json({ error: 'sender, name, and permlink are required' });
    }

    // Require at least one valid Walrus blob for the entry point
    const blobIdsArray = Array.isArray(blobIds) ? blobIds : [];
    if (blobIdsArray.length === 0) {
      return res.status(400).json({ error: 'dApps require at least one valid Walrus blob. Upload your content first.' });
    }
    const entryBlobId = manifest?.entryPoint && /^[a-zA-Z0-9_-]+$/.test(String(manifest.entryPoint).trim())
      ? String(manifest.entryPoint).trim()
      : blobIdsArray[0];
    if (!blobIdsArray.includes(entryBlobId)) {
      return res.status(400).json({ error: 'Entry point must reference a valid Walrus blob in blobIds.' });
    }
    try {
      const axios = require('axios');
      const walrusRes = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(entryBlobId)}/info`, { validateStatus: () => true });
      if (walrusRes.status !== 200) {
        return res.status(400).json({ error: 'Entry blob not found in Walrus. Upload your content to Walrus before posting.' });
      }
    } catch (walrusErr) {
      logger.warn('Walrus blob validation failed', { entryBlobId, error: walrusErr });
      return res.status(400).json({ error: 'Could not verify entry blob in Walrus. Ensure your content is uploaded.' });
    }

    // Fetch blob sizes from Walrus service (for on-chain storage cost calculation)
    const blobSizes: number[] = [];
    // Use governance config for votable_posting_fee instead of hardcoded 1 SUI
    const govCfg = await getGovernanceConfig();
    const votableFeeSui = govCfg ? govCfg.votable_posting_fee / 1_000_000_000 : 1.0;
    let minPostingFee = votableFeeSui;
    try {
      const axios = require('axios');
      // Fetch blob info to get sizes
      for (const blobId of blobIdsArray) {
        try {
          const blobRes = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(blobId)}/info`, { validateStatus: () => true });
          if (blobRes.status === 200 && blobRes.data?.size != null) {
            blobSizes.push(Number(blobRes.data.size));
          } else {
            blobSizes.push(0); // Will be validated on-chain
          }
        } catch {
          blobSizes.push(0);
        }
      }
      
      // Get storage cost from Walrus billing, compute min = 2×storage + votableFee
      const batchRes = await axios.post(`${WALRUS_SERVICE_URL}/blobs/billing/batch`, { blobIds: blobIdsArray }, { validateStatus: () => true });
      if (batchRes.status === 200 && batchRes.data?.storageCost != null) {
        const storageCostSui = Number(batchRes.data.storageCost);
        minPostingFee = 2 * storageCostSui + votableFeeSui;
      } else if (batchRes.status === 200 && batchRes.data?.minPostingFee != null) {
        // Fallback: use Walrus-reported min (legacy)
        minPostingFee = Number(batchRes.data.minPostingFee);
      }
    } catch { /* use default votable fee */ }

    // Validate all blob sizes were found
    if (blobSizes.length !== blobIdsArray.length || blobSizes.some(s => s === 0)) {
      return res.status(400).json({ error: 'Could not retrieve blob sizes from Walrus. Ensure all blobs are uploaded and accessible.' });
    }

    const feeSui = Number(postingFeeSui) || 0;
    if (feeSui < minPostingFee) {
      return res.status(400).json({ error: `Posting fee must be at least ${minPostingFee.toFixed(4)} SUI (2×storage + votable fee)` });
    }

    const configId = process.env.POSTING_TREASURY_CONFIG_ID || '';
    const registryId = process.env.POSTING_REGISTRY_ID || '';
    const govConfigId = process.env.GOVERNANCE_CONFIG_ID || '';
    if (!configId) {
      return res.status(503).json({ error: 'POSTING_TREASURY_CONFIG_ID must be configured' });
    }
    if (!registryId) {
      return res.status(503).json({ error: 'POSTING_REGISTRY_ID must be configured' });
    }
    if (!govConfigId) {
      return res.status(503).json({ error: 'GOVERNANCE_CONFIG_ID must be configured' });
    }

    const MIST_PER_SUI = 1_000_000_000;
    const feeMist = BigInt(Math.max(Math.round(feeSui * MIST_PER_SUI), 1_000_000));

    // We need the PostingFeePool object ID
    // Try to read from env, deploy output, or .posting_pool_id file
    let poolId = process.env.POSTING_POOL_ID || '';
    if (!poolId) {
      try {
        const fs = require('fs');
        const path = require('path');
        const poolFile = path.resolve(__dirname, '../../../../tests/e2e/scripts/.posting_pool_id');
        poolId = fs.readFileSync(poolFile, 'utf8').trim();
      } catch { /* ignore */ }
    }
    if (!poolId) {
      return res.status(503).json({ error: 'POSTING_POOL_ID not configured' });
    }

    const toBytes = (s: string): number[] => Array.from(new TextEncoder().encode(s || ''));

    const tx = new Transaction();
    const [feeCoin] = tx.splitCoins(tx.gas, [feeMist]);

    tx.moveCall({
      target: `${packageId}::dapp_posting::post_dapp`,
      arguments: [
        tx.object(registryId),
        tx.object(poolId),
        tx.object(configId), // PostingTreasuryConfig - canonical addresses, caller cannot override
        tx.object(govConfigId), // GovernanceConfig - votable params (fee, PM duration, splits)
        tx.pure.vector('u8', toBytes(name)),
        tx.pure.vector('u8', toBytes(description || '')),
        tx.pure.vector('u8', toBytes(permlink)),
        tx.pure.vector('u8', toBytes(version || '1.0.0')),
        tx.pure.vector('u8', toBytes(typeof manifest === 'string' ? manifest : JSON.stringify(manifest || {}))),
        tx.pure(bcs.vector(bcs.vector(bcs.u8())).serialize((blobIds || []).map((b: string) => toBytes(b))).toBytes()),
        tx.pure(bcs.vector(bcs.u64()).serialize(blobSizes.map((s: number) => BigInt(s))).toBytes()), // Blob sizes in bytes
        tx.pure(bcs.vector(bcs.vector(bcs.u8())).serialize((tags || []).map((t: string) => toBytes(t))).toBytes()),
        tx.pure.vector('u8', toBytes(category || '')),
        feeCoin,
        tx.object('0x6'), // Clock
      ],
    });

    tx.setSender(sender);
    tx.setGasBudget(50_000_000);

    // Use SUI_RPC_URL if set, otherwise infer from SUI_NETWORK (defaults to mainnet in sui/client.ts)
    const network = process.env.SUI_NETWORK || 'mainnet';
    const rpcUrl = process.env.SUI_RPC_URL || 
      (network === 'testnet' 
        ? 'https://fullnode.testnet.sui.io:443'
        : 'https://fullnode.mainnet.sui.io:443');
    const client = new SuiClient({ url: rpcUrl });
    const txBytes = await tx.build({ client });

    res.json({
      txBytes: Buffer.from(txBytes).toString('base64'),
      packageId,
      poolId,
      feeMist: feeMist.toString(),
      minPostingFee, // Include calculated minimum for frontend display
      feeSui // Include the fee in SUI for verification
    });
  } catch (error: any) {
    logger.error('Error building on-chain dApp tx', error);
    res.status(500).json({ error: error.message || 'Failed to build transaction' });
  }
});

// Build set_muted transaction (pause/unpause dApp)
router.post('/build-set-muted-tx', async (req, res) => {
  try {
    const packageId = process.env.SUI_PACKAGE_ID;
    if (!packageId) {
      return res.status(503).json({ error: 'SUI_PACKAGE_ID not configured - on-chain operations not available' });
    }

    const { Transaction } = require('@mysten/sui/transactions');
    const { SuiClient } = require('@mysten/sui/client');
    const { bcs } = require('@mysten/sui/bcs');

    const { sender, owner, permlink, muted } = req.body;

    if (!sender || !owner || !permlink || typeof muted !== 'boolean') {
      return res.status(400).json({ error: 'sender, owner, permlink, and muted (boolean) are required' });
    }

    const registryId = process.env.POSTING_REGISTRY_ID || '';
    if (!registryId) {
      return res.status(503).json({ error: 'POSTING_REGISTRY_ID must be configured' });
    }

    // Find dapp_id by querying events for DappPosted with matching owner+permlink
    // We'll need to query the SUI chain for the event
    const network = process.env.SUI_NETWORK || 'mainnet';
    const rpcUrl = process.env.SUI_RPC_URL || 
      (network === 'testnet' 
        ? 'https://fullnode.testnet.sui.io:443'
        : 'https://fullnode.mainnet.sui.io:443');
    const client = new SuiClient({ url: rpcUrl });

    // Query for DappPosted events with matching owner and permlink
    let dappIdBytes: Uint8Array | null = null;
    try {
      const events = await client.queryEvents({
        query: {
          MoveEventModule: {
            package: packageId,
            module: 'dapp_posting'
          }
        },
        limit: 100,
        order: 'descending'
      });

      const toBytes = (s: string): number[] => Array.from(new TextEncoder().encode(s || ''));
      const ownerBytes = toBytes(owner.toLowerCase());
      const permlinkBytes = toBytes(permlink);

      // Find matching DappPosted event
      for (const event of events.data) {
        if (event.type.includes('::DappPosted')) {
          const eventData = event.parsedJson as any;
          const eventOwner = String(eventData.owner || '').toLowerCase();
          const eventPermlink = typeof eventData.permlink === 'string' 
            ? eventData.permlink 
            : (Array.isArray(eventData.permlink) 
              ? new TextDecoder().decode(new Uint8Array(eventData.permlink))
              : '');
          
          if (eventOwner === owner.toLowerCase() && eventPermlink === permlink) {
            // Found matching event - extract dapp_id
            if (eventData.dapp_id) {
              if (Array.isArray(eventData.dapp_id)) {
                dappIdBytes = new Uint8Array(eventData.dapp_id);
              } else if (typeof eventData.dapp_id === 'string') {
                // Hex string
                dappIdBytes = new Uint8Array(Buffer.from(eventData.dapp_id.slice(2), 'hex'));
              }
              break;
            }
          }
        }
      }
    } catch (queryError) {
      logger.warn('Failed to query events for dapp_id', { owner, permlink, error: queryError });
    }

    if (!dappIdBytes || dappIdBytes.length !== 32) {
      return res.status(404).json({ 
        error: 'dApp not found on-chain. Ensure the dApp was posted on-chain first.',
        hint: 'The dApp must be posted via post_dapp before it can be paused/unpaused.'
      });
    }

    const toBytes = (s: string): number[] => Array.from(new TextEncoder().encode(s || ''));

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::dapp_posting::set_muted`,
      arguments: [
        tx.object(registryId),
        tx.pure.vector('u8', Array.from(dappIdBytes)),
        tx.pure.bool(muted)
      ],
    });

    tx.setSender(sender);
    tx.setGasBudget(10_000_000); // Lower gas budget for simple call

    const txBytes = await tx.build({ client });

    res.json({
      txBytes: Buffer.from(txBytes).toString('base64'),
      packageId,
      registryId,
      dappId: Buffer.from(dappIdBytes).toString('hex')
    });
  } catch (error: any) {
    logger.error('Error building set_muted tx', error);
    res.status(500).json({ error: error.message || 'Failed to build transaction' });
  }
});

// Create/Update dApp - SECURITY: Requires JWT auth and on-chain posting for new dApps
// New dApps MUST be posted on-chain first (via /build-tx + wallet signature). 
// The indexer will automatically create the dApp record from the DappPosted event.
// This endpoint only allows updates to existing on-chain dApps.
router.post('/', async (req, res) => {
  try {
    // Require JWT authentication
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'JWT authentication required. Use Authorization: Bearer <token> header.' });
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    const decoded = await authService.verifyToken(token);
    if (!decoded || !decoded.suiAddress) {
      return res.status(401).json({ error: 'Invalid or expired JWT token' });
    }

    const {
      name,
      description,
      owner,
      version,
      manifest,
      blobIds,
      tags,
      permlink,
      category,
      postingFee,
      existingId
    }: {
      name: string;
      description: string;
      owner: string;
      version?: string;
      manifest?: any;
      blobIds?: string[];
      tags?: string[];
      permlink?: string;
      category?: string;
      postingFee?: number;
      existingId?: string;
    } = req.body;

    if (!name || !owner) {
      return res.status(400).json({ error: 'Name and owner are required' });
    }

    // Verify JWT address matches owner
    if (String(decoded.suiAddress).toLowerCase() !== String(owner).toLowerCase()) {
      return res.status(403).json({ error: 'JWT address does not match owner. You can only create/update dApps for your own address.' });
    }

    const isUpdate = !!existingId?.trim();
    let dapp!: SUIdApp; // assigned in both isUpdate and !isUpdate branches below

    if (isUpdate) {
      const existing = await dappRepository.findById(existingId!.trim());
      if (!existing) {
        return res.status(404).json({ error: 'dApp not found' });
      }
      if (String(existing.owner).toLowerCase() !== String(owner).toLowerCase()) {
        return res.status(403).json({ error: 'Only the owner can update this dApp' });
      }
      dapp = existing;
    } else {
      // For NEW dApps, automatically build the on-chain transaction
      // The frontend will sign and execute it, then the indexer will create the dApp record
      const finalPermlink = permlink || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existingOnChain = await dappRepository.findByOwnerAndPermlink(owner, finalPermlink);
      
      if (existingOnChain) {
        // dApp already exists on-chain, treat as update
        dapp = existingOnChain;
      } else {
        // New dApp - build transaction and return it for signing
        const packageId = process.env.SUI_PACKAGE_ID;
        if (!packageId) {
          return res.status(503).json({ error: 'SUI_PACKAGE_ID not configured - on-chain operations not available' });
        }

        const registryId = process.env.POSTING_REGISTRY_ID || '';
        const poolId = process.env.POSTING_POOL_ID || '';
        const treasuryConfigId = process.env.POSTING_TREASURY_CONFIG_ID || '';
        const govConfigId = process.env.GOVERNANCE_CONFIG_ID || '';
        
        if (!registryId || !poolId || !treasuryConfigId || !govConfigId) {
          return res.status(503).json({ 
            error: 'On-chain configuration incomplete',
            missing: {
              registry: !registryId,
              pool: !poolId,
              treasury: !treasuryConfigId,
              governance: !govConfigId
            }
          });
        }

        // Validate blobIds
        const blobIdsArray: string[] = Array.isArray(blobIds) ? blobIds : [];
        if (blobIdsArray.length === 0) {
          return res.status(400).json({ error: 'dApps require at least one valid Walrus blob. Upload your content first.' });
        }

        // Resolve manifest if stored in Walrus
        let resolvedManifest = manifest;
        if (typeof manifest === 'string' && manifest.startsWith('walrus:')) {
          const blobId = manifest.slice(7).trim();
          try {
            const axios = require('axios');
            const blobRes = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(blobId)}`, {
              responseType: 'arraybuffer',
              validateStatus: () => true
            });
            if (blobRes.status === 200) {
              const text = new TextDecoder().decode(blobRes.data);
              resolvedManifest = typeof text === 'string' ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
            }
          } catch (walrusErr) {
            logger.warn('Walrus manifest resolve failed', { blobId, error: walrusErr });
          }
        }

        const manifestEntry = resolvedManifest?.entryPoint;
        const entryBlobId: string = manifestEntry && /^[a-zA-Z0-9_-]+$/.test(String(manifestEntry).trim())
          ? String(manifestEntry).trim()
          : blobIdsArray[0];
        if (!blobIdsArray.includes(entryBlobId)) {
          return res.status(400).json({ error: 'Entry point must reference a valid Walrus blob in blobIds.' });
        }

        // Fetch blob sizes from Walrus service (for on-chain storage cost calculation)
        const blobSizes: number[] = [];
        // Use governance config for votable_posting_fee instead of hardcoded 1 SUI
        const govCfgPost = await getGovernanceConfig();
        const votableFeeSuiPost = govCfgPost ? govCfgPost.votable_posting_fee / 1_000_000_000 : 1.0;
        let minPostingFee = votableFeeSuiPost;
        try {
          const axios = require('axios');
          // Fetch blob info to get sizes
          for (const blobId of blobIdsArray) {
            try {
              const blobRes = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(blobId)}/info`, { validateStatus: () => true });
              if (blobRes.status === 200 && blobRes.data?.size != null) {
                blobSizes.push(Number(blobRes.data.size));
              } else {
                blobSizes.push(0); // Will be validated on-chain
              }
            } catch {
              blobSizes.push(0);
            }
          }
          
          // Get storage cost from Walrus billing, compute min = 2×storage + votableFee
          const batchRes = await axios.post(`${WALRUS_SERVICE_URL}/blobs/billing/batch`, { blobIds: blobIdsArray }, { validateStatus: () => true });
          if (batchRes.status === 200 && batchRes.data?.storageCost != null) {
            const scSui = Number(batchRes.data.storageCost);
            minPostingFee = 2 * scSui + votableFeeSuiPost;
          } else if (batchRes.status === 200 && batchRes.data?.minPostingFee != null) {
            minPostingFee = Number(batchRes.data.minPostingFee);
          }
        } catch { /* use default votable fee */ }

        // Validate all blob sizes were found
        if (blobSizes.length !== blobIdsArray.length || blobSizes.some(s => s === 0)) {
          return res.status(400).json({ error: 'Could not retrieve blob sizes from Walrus. Ensure all blobs are uploaded and accessible.' });
        }

        const finalFee = postingFee && postingFee >= minPostingFee ? postingFee : minPostingFee;
        const feeMist = BigInt(Math.max(Math.round(finalFee * 1_000_000_000), 1_000_000));

        // Build transaction
        const { Transaction } = require('@mysten/sui/transactions');
        const { SuiClient } = require('@mysten/sui/client');
        const { bcs } = require('@mysten/sui/bcs');
        const network = process.env.SUI_NETWORK || 'mainnet';
        const rpcUrl = process.env.SUI_RPC_URL || 
          (network === 'testnet' 
            ? 'https://fullnode.testnet.sui.io:443'
            : 'https://fullnode.mainnet.sui.io:443');
        const client = new SuiClient({ url: rpcUrl });

        const toBytes = (s: string): number[] => Array.from(new TextEncoder().encode(s || ''));
        const manifestForChain = typeof manifest === 'string' && manifest.startsWith('walrus:') 
          ? manifest 
          : `walrus:${blobIdsArray[0]}`;

        const tx = new Transaction();
        // Split posting fee coin from gas
        const [feeCoin] = tx.splitCoins(tx.gas, [feeMist]);

        tx.moveCall({
          target: `${packageId}::dapp_posting::post_dapp`,
          arguments: [
            tx.object(registryId),
            tx.object(poolId),
            tx.object(treasuryConfigId),
            tx.object(govConfigId), // GovernanceConfig - votable params (fee, PM duration, splits)
            tx.pure.vector('u8', toBytes(name)),
            tx.pure.vector('u8', toBytes(description || '')),
            tx.pure.vector('u8', toBytes(finalPermlink)),
            tx.pure.vector('u8', toBytes(version || '1.0.0')),
            tx.pure.vector('u8', toBytes(manifestForChain)),
            tx.pure(bcs.vector(bcs.vector(bcs.u8())).serialize(blobIdsArray.map((b: string) => toBytes(b))).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(blobSizes.map((s: number) => BigInt(s))).toBytes()), // Blob sizes in bytes
            tx.pure(bcs.vector(bcs.vector(bcs.u8())).serialize((tags || []).map((t: string) => toBytes(t))).toBytes()),
            tx.pure.vector('u8', toBytes(category || '')),
            feeCoin,
            tx.object('0x6') // Clock
          ],
        });

        tx.setSender(owner);
        tx.setGasBudget(50_000_000);

        let txBytes: Uint8Array;
        try {
          txBytes = await tx.build({ client });
        } catch (buildError: any) {
          logger.error('Transaction build failed', {
            error: buildError.message,
            stack: buildError.stack,
            packageId,
            registryId,
            poolId,
            treasuryConfigId,
            argumentCount: 13, // registry, pool, config, name, description, permlink, version, manifest, blobIds, tags, category, feeCoin, clock
            owner,
            finalPermlink
          });
          throw buildError;
        }

        // Return transaction for frontend to sign and execute
        return res.json({
          requiresOnChainPosting: true,
          txBytes: Buffer.from(txBytes).toString('base64'),
          packageId,
          registryId,
          poolId,
          treasuryConfigId,
          feeSui: finalFee,
          minPostingFee,
          blobIds: blobIdsArray,
          permlink: finalPermlink
        });
      }
    }

    // SECURITY: Block ALL metadata updates via API endpoint
    // Updates must go through on-chain update_dapp_metadata which enforces the 3-day lock
    // and triggers new PMs as needed. This prevents bypassing security controls.
    if (isUpdate) {
      // Check if update would be blocked by 3-day lock
      const now = Date.now();
      const createdAt = dapp.createdAt instanceof Date ? dapp.createdAt.getTime() : new Date(dapp.createdAt).getTime();
      const timeSincePosting = now - createdAt;
      const isWithinLockPeriod = timeSincePosting < UPDATE_LOCK_MS;

      // Check for active prediction markets
      let hasActivePM = false;
      try {
        const axios = require('axios');
        const marketsRes = await axios.get(`${DGRAPH_SERVICE_URL}/markets/dapp/${dapp.id}`, { validateStatus: () => true });
        if (marketsRes.status === 200 && marketsRes.data?.markets && Array.isArray(marketsRes.data.markets)) {
          hasActivePM = marketsRes.data.markets.length > 0;
        }
      } catch (pmCheckError) {
        logger.warn('Failed to check active PMs', { dappId: dapp.id, error: pmCheckError });
        // If we can't check PMs, be conservative and assume PM is active if within lock period
        if (isWithinLockPeriod) {
          hasActivePM = true;
        }
      }

      if (isWithinLockPeriod || hasActivePM) {
        return res.status(403).json({
          error: 'dApp metadata updates are not allowed while prediction market is active. Updates are blocked for 3 days after posting to allow the PM to resolve on initial data.',
          hint: 'You can pause/mute your dApp via set_muted if bugs are found, but metadata updates require waiting for the PM to resolve. Use on-chain update_dapp_metadata after the lock period.',
          lockPeriodRemaining: isWithinLockPeriod ? Math.ceil((UPDATE_LOCK_MS - timeSincePosting) / (1000 * 60 * 60 * 24)) + ' days' : 'PM still active'
        });
      }

      // Even after lock period, block API updates - must use on-chain
      return res.status(403).json({
        error: 'Metadata updates must be performed on-chain via update_dapp_metadata. This ensures proper PM triggering and security controls.',
        hint: 'After the 3-day lock period, use the on-chain update_dapp_metadata function. Updates trigger new prediction markets to ensure continued safety verification.'
      });
    }

    // For new dApps (not updates), this endpoint should not be used
    // They must be posted on-chain first (already validated above)
    // This path should rarely be reached, but if it is, we've already validated the dApp exists on-chain
    return res.status(403).json({
      error: 'This endpoint does not support creating new dApps. Use POST /dapps/build-tx to build an on-chain transaction, sign it with your wallet, and submit it. The indexer will automatically create the dApp record.',
      hint: 'New dApps require on-chain payment via post_dapp to trigger prediction markets.'
    });

  } catch (error) {
    logger.error('Error creating dApp', error);
    res.status(500).json({ error: 'Failed to create dApp' });
  }
});

export { router as dappsRouter };