import { SuiEvent } from '@mysten/sui/client';
import axios from 'axios';
import { SUIdApp } from '@dlux-sui/types';
import { logger } from '../../utils/logger';
import { dappRepository } from '../../repositories/dappRepository';

const DGRAPH_SERVICE = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';

/** LRU cache for resolved Walrus manifests to avoid repeated network round-trips. */
const manifestCache = new Map<string, { data: any; ts: number }>();
const MANIFEST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MANIFEST_CACHE_MAX = 500;

/** Track PM-created dApp IDs to prevent duplicates within this process lifetime. */
const pmCreatedSet = new Set<string>();

/** Decode Move byte vectors: parsedJson may give an array of numbers or a hex string. */
function decodeBytesField(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    try {
      return new TextDecoder().decode(new Uint8Array(raw));
    } catch {
      return raw.map((b: number) => String.fromCharCode(b)).join('');
    }
  }
  return String(raw ?? '');
}

/** Decode a vector<vector<u8>> field (e.g. blob_ids, tags). */
function decodeVecOfBytes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => decodeBytesField(item));
}

class DAppProcessor {
  async process(event: SuiEvent): Promise<void> {
    try {
      logger.debug('Processing dApp event', { eventId: event.id, type: event.type });

      const eventData = event.parsedJson as any;
      if (!eventData) return;

      // Route by event type suffix
      if (event.type.includes('::DappPosted')) {
        await this.handleDappPosted(event, eventData);
      } else if (event.type.includes('::PredictionMarketTriggered')) {
        await this.handlePMTriggered(event, eventData);
      } else if (event.type.includes('::DappMuteUpdated')) {
        await this.handleDappMuteUpdated(event, eventData);
      } else {
        // Legacy: try to extract dApp from generic event
        const dapp = this.extractDAppFromEvent(event);
        if (dapp) {
          await dappRepository.save(dapp);
          await this.sendToDGraph(dapp);
          await this.createPredictionMarket(dapp, event);
          logger.info('Processed dApp (legacy)', { id: dapp.id, name: dapp.name });
        }
      }
    } catch (error) {
      logger.error('Error processing dApp event', { eventId: event.id, error });
      throw error;
    }
  }

  /** Handle DappPosted event from dapp_posting contract. */
  private async handleDappPosted(event: SuiEvent, data: any): Promise<void> {
    const owner = String(data.owner ?? '').toLowerCase();
    const permlink = decodeBytesField(data.permlink);
    // URL-safe id for detail links: owner_permlink (contract emits dapp_id as hash bytes, not suitable for URLs)
    const urlSafeId = owner && permlink ? `${owner}_${permlink}` : `onchain_${event.id?.txDigest}_${event.id?.eventSeq}`;

    const manifestRaw = decodeBytesField(data.manifest);
    const manifest = await this.resolveManifest(manifestRaw);

    // Extract on-chain dapp_id (hash bytes) for future lookups
    const onChainDappId = data.dapp_id;
    const onChainDappIdHex = Array.isArray(onChainDappId)
      ? Buffer.from(onChainDappId).toString('hex')
      : (typeof onChainDappId === 'string' ? onChainDappId.replace(/^0x/, '') : '');

    const dapp: SUIdApp = {
      id: urlSafeId,
      name: decodeBytesField(data.name),
      description: decodeBytesField(data.description),
      owner: data.owner || '',
      version: decodeBytesField(data.version) || '1.0.0',
      manifest,
      blobIds: decodeVecOfBytes(data.blob_ids),
      tags: decodeVecOfBytes(data.tags),
      createdAt: event.timestampMs ? new Date(Number(event.timestampMs)) : new Date(),
      updatedAt: event.timestampMs ? new Date(Number(event.timestampMs)) : new Date(),
      permlink
    };
    
    // Store on-chain dapp_id and txDigest for lookups and explorer links
    const txDigest = event.id?.txDigest || '';
    (dapp as any).onChainDappId = onChainDappIdHex;
    (dapp as any).txDigest = txDigest;

    const category = decodeBytesField(data.category);
    const postingFee = Number(data.posting_fee || 0);

    logger.info('DappPosted event received', {
      dappId: dapp.id,
      name: dapp.name,
      owner: dapp.owner,
      permlink: dapp.permlink,
      postingFee,
      txDigest
    });

    // Store locally
    await dappRepository.save(dapp);

    // Forward to DGraph (source of truth for queries)
    await this.sendToDGraph(dapp, { category, postingFee, txDigest, onChainDappId: onChainDappIdHex });

    // PM creation is triggered by separate PredictionMarketTriggered event.
    // Only create from here as a safety net, and deduplicate via pmCreatedSet.
    if (postingFee > 0) {
      const pmKey = `${dapp.id}_nsfw`;
      if (!pmCreatedSet.has(pmKey)) {
        pmCreatedSet.add(pmKey);
        await this.createPredictionMarket(dapp, event);
      } else {
        logger.debug('PM already created for this dApp, skipping duplicate', { dappId: dapp.id });
      }
    }
  }

  /** Handle DappMuteUpdated event from dapp_posting contract. */
  private async handleDappMuteUpdated(event: SuiEvent, data: any): Promise<void> {
    const rawDappId = decodeBytesField(data.dapp_id);
    const owner = String(data.owner || '').toLowerCase();
    const muted = Boolean(data.muted);

    // Convert dapp_id bytes to hex for lookup
    const dappIdHex = Array.isArray(rawDappId) 
      ? Buffer.from(rawDappId).toString('hex')
      : (typeof rawDappId === 'string' ? rawDappId.replace(/^0x/, '') : '');

    // Find dApp by owner and match by stored onChainDappId
    const ownerDapps = await dappRepository.findByOwner(owner);
    
    let updated = false;
    for (const dapp of ownerDapps) {
      // Match by stored onChainDappId
      const storedOnChainId = (dapp as any).onChainDappId;
      if (storedOnChainId && storedOnChainId.toLowerCase() === dappIdHex.toLowerCase()) {
        // Found matching dApp
        (dapp as any).muted = muted;
        await dappRepository.save(dapp);
        updated = true;
        
        // Update in DGraph
        try {
          const axios = require('axios');
          await axios.post(`${DGRAPH_SERVICE}/installs/dapps/index`, {
            id: dapp.id,
            name: dapp.name,
            description: dapp.description,
            owner: dapp.owner,
            permlink: dapp.permlink,
            version: dapp.version,
            manifest: dapp.manifest,
            blobIds: dapp.blobIds,
            tags: dapp.tags,
            category: (dapp as any).category || '',
            postingFee: (dapp as any).postingFee || 0,
            muted,
            createdAt: dapp.createdAt,
            updatedAt: new Date()
          });
          logger.info('Updated dApp muted status', { dappId: dapp.id, muted, dappIdHex });
        } catch (dgErr) {
          logger.warn('Failed to update muted status in DGraph', { dappId: dapp.id, error: dgErr });
        }
        break;
      }
    }
    
    if (!updated) {
      logger.warn('DappMuteUpdated event for unknown dApp', { owner, dappIdHex });
    }
  }

  /** Handle PredictionMarketTriggered event from dapp_posting contract. */
  private async handlePMTriggered(event: SuiEvent, data: any): Promise<void> {
    const owner = String(data.triggered_by || '').toLowerCase();
    const contribution = Number(data.posting_fee_contribution || 0);

    // dapp_id from the contract is a keccak256 hash (32 bytes). Convert to hex for lookups.
    const rawDappIdBytes = data.dapp_id;
    const dappIdHex = Array.isArray(rawDappIdBytes)
      ? Buffer.from(rawDappIdBytes).toString('hex')
      : (typeof rawDappIdBytes === 'string' ? rawDappIdBytes.replace(/^0x/, '') : '');

    // The PredictionMarketTriggered event does NOT contain permlink.
    // Look up the dApp from the in-memory repository (saved by handleDappPosted which fires first)
    // to get the correct URL-safe ID (owner_permlink format).
    let dappId = '';
    if (owner) {
      const ownerDapps = await dappRepository.findByOwner(owner);
      for (const d of ownerDapps) {
        if ((d as any).onChainDappId === dappIdHex) {
          dappId = d.id;
          break;
        }
      }
    }
    // Fallback: if we couldn't find the dApp in repo, use hex hash (better than garbage UTF-8)
    if (!dappId) {
      dappId = dappIdHex || `pm_unknown_${event.id?.txDigest}`;
    }

    logger.info('PredictionMarketTriggered event', { dappId, dappIdHex, contribution, owner });

    // Deduplicate: if handleDappPosted already created a PM, skip
    const pmKey = `${dappId}_nsfw`;
    if (pmCreatedSet.has(pmKey)) {
      logger.debug('PM already created by DappPosted handler, skipping', { dappId });
      return;
    }
    pmCreatedSet.add(pmKey);

    try {
      await axios.post(`${DGRAPH_SERVICE}/markets`, {
        dappId,
        safetyMetric: 'safe-and-accurate',
        description: `Safety review for dApp ${dappId}`,
        postingFeeContribution: contribution,
        triggeredBy: 'on-chain-posting',
        triggeredByAddress: owner,
        txDigest: event.id?.txDigest || ''
      });
      logger.info('Created PM from PredictionMarketTriggered event', { dappId });
    } catch (error) {
      logger.error('Failed to create PM from PredictionMarketTriggered', { dappId, error });
    }
  }

  /** Forward dApp data to DGraph service for indexing. SUI chain is source of truth; DGraph mirrors it. */
  async sendToDGraph(dapp: SUIdApp, extra?: { category?: string; postingFee?: number; txDigest?: string; onChainDappId?: string; muted?: boolean }): Promise<void> {
    try {
      const axios = require('axios');
      const payload = {
        id: dapp.id,
        name: dapp.name,
        description: dapp.description,
        owner: dapp.owner,
        permlink: dapp.permlink,
        version: dapp.version,
        manifest: dapp.manifest,
        blobIds: dapp.blobIds,
        tags: dapp.tags,
        category: extra?.category || '',
        postingFee: extra?.postingFee || 0,
        txDigest: extra?.txDigest || '',
        onChainDappId: extra?.onChainDappId || (dapp as any).onChainDappId || '',
        muted: extra?.muted !== undefined ? extra.muted : ((dapp as any).muted || false),
        createdAt: dapp.createdAt,
        updatedAt: dapp.updatedAt,
        source: 'sui-chain' // Indicates this came from on-chain event
      };

      await axios.post(`${DGRAPH_SERVICE}/installs/dapps/index`, payload);
      logger.info('Sent dApp to DGraph', { id: dapp.id, name: dapp.name });
    } catch (error: any) {
      // If the specific index endpoint doesn't exist, fallback to generic dapps endpoint
      if (error?.response?.status === 404) {
        try {
          const axios = require('axios');
          await axios.post(`${DGRAPH_SERVICE}/dapps`, {
            id: dapp.id,
            name: dapp.name,
            description: dapp.description,
            owner: dapp.owner,
            permlink: dapp.permlink,
            version: dapp.version,
            manifest: dapp.manifest,
            blobIds: dapp.blobIds,
            tags: dapp.tags,
            source: 'sui-chain'
          });
          logger.info('Sent dApp to DGraph (fallback)', { id: dapp.id });
        } catch (fallbackErr) {
          logger.error('Failed to send dApp to DGraph (fallback)', { id: dapp.id, error: fallbackErr });
        }
      } else {
        logger.error('Failed to send dApp to DGraph', { id: dapp.id, error });
      }
    }
  }

  private extractDAppFromEvent(event: SuiEvent): SUIdApp | null {
    try {
      const eventData = event.parsedJson as any;
      if (!this.isValidDAppEvent(eventData)) return null;

      return {
        id: eventData.id || `${event.id?.txDigest}_${event.id?.eventSeq}`,
        name: decodeBytesField(eventData.name) || '',
        description: decodeBytesField(eventData.description) || '',
        owner: eventData.owner || '',
        version: decodeBytesField(eventData.version) || '1.0.0',
        manifest: eventData.manifest || {},
        blobIds: eventData.blobIds || [],
        tags: eventData.tags || [],
        createdAt: event.timestampMs ? new Date(Number(event.timestampMs)) : new Date(),
        updatedAt: event.timestampMs ? new Date(Number(event.timestampMs)) : new Date(),
        permlink: decodeBytesField(eventData.permlink) || eventData.id || ''
      };
    } catch (error) {
      logger.error('Error extracting dApp from event', error);
      return null;
    }
  }

  private isValidDAppEvent(eventData: any): boolean {
    return eventData && (eventData.name || eventData.manifest);
  }

  private async createPredictionMarket(dapp: SUIdApp, event: SuiEvent): Promise<void> {
    try {
      const eventData = event.parsedJson as any;
      const postingFee = Number(eventData.posting_fee || eventData.postingFee || eventData.fee || 0);

      if (postingFee > 0) {
        const axios = require('axios');
        const marketContribution = postingFee * 0.5;

        await axios.post(`${DGRAPH_SERVICE}/markets`, {
          dappId: dapp.id,
          safetyMetric: 'safe-and-accurate',
          description: `Safety review for ${dapp.name}`,
          postingFeeContribution: marketContribution,
          triggeredBy: 'posting',
          triggeredByAddress: dapp.owner,
          txDigest: event.id?.txDigest || ''
        });

        logger.info('Created prediction market for dApp', { dappId: dapp.id, contribution: marketContribution });
      }
    } catch (error) {
      logger.error('Failed to create prediction market', error);
    }
  }

  /** If manifest is "walrus:blobId", fetch blob and return parsed JSON; otherwise parse inline JSON. */
  private async resolveManifest(manifestStr: string): Promise<any> {
    if (!manifestStr) return {};
    const walrusPrefix = 'walrus:';
    if (manifestStr.startsWith(walrusPrefix)) {
      const blobId = manifestStr.slice(walrusPrefix.length).trim();
      if (!blobId) return {};

      // Check cache first
      const cached = manifestCache.get(blobId);
      if (cached && Date.now() - cached.ts < MANIFEST_CACHE_TTL) {
        logger.debug('Manifest cache hit', { blobId });
        return cached.data;
      }

      try {
        const res = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(blobId)}`, {
          responseType: 'arraybuffer',
          timeout: 10000, // 10s timeout for manifest fetches
          validateStatus: () => true
        });
        if (res.status !== 200) {
          logger.warn('Walrus manifest blob fetch failed', { blobId, status: res.status });
          return { raw: manifestStr };
        }
        const text = new TextDecoder().decode(res.data);
        const parsed = this.tryParseJson(text);

        // Store in cache, evict oldest if over limit
        if (manifestCache.size >= MANIFEST_CACHE_MAX) {
          const oldestKey = manifestCache.keys().next().value;
          if (oldestKey) manifestCache.delete(oldestKey);
        }
        manifestCache.set(blobId, { data: parsed, ts: Date.now() });

        return parsed;
      } catch (err) {
        logger.warn('Walrus manifest blob fetch error', { blobId, error: err });
        return { raw: manifestStr };
      }
    }
    return this.tryParseJson(manifestStr);
  }

  private tryParseJson(str: string): any {
    if (!str) return {};
    try {
      return JSON.parse(str);
    } catch {
      return { raw: str };
    }
  }
}

export const dappProcessor = new DAppProcessor();