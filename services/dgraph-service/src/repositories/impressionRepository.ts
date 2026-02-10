import { dgraphClient } from '../dgraph/client';
import { logger } from '../utils/logger';

export interface AdImpression {
  uid?: string;
  id: string;
  adId: string;
  contentId: string;
  zkProof: string; // JSON string
  proofHash: string;
  encryptedViewer: string;
  blockHeader: string;
  timestamp: Date;
  merklePath?: string;
  merkleIndex?: number;
  verified: boolean;
  settled?: boolean;
  settledAt?: Date;
  revenueDistributed?: boolean;
  walrusDrawdownUsed?: boolean;
  walrusDrawdownUsedAt?: Date;
  walrusDrawdownPending?: boolean;
  walrusDrawdownPendingAt?: Date;
}

export interface AdAggregate {
  id: string;
  adId: string;
  contentId: string;
  encryptedCount: string;
  merkleRoot: string;
  threshold: number;
  currentCount: number;
  reachedAt?: Date;
  distributed: boolean;
}

// Check if DGraph is available (for in-memory fallback)
function isDGraphAvailable(): boolean {
  try {
    dgraphClient.getClient();
    return true;
  } catch {
    return false;
  }
}

export class ImpressionRepository {
  private inMemoryImpressions: AdImpression[] = [];
  private inMemoryAggregates: AdAggregate[] = [];

  private isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  // Use in-memory mode if DGraph not available or in test mode
  private useInMemory(): boolean {
    return this.isTest() || !isDGraphAvailable();
  }

  /**
   * Save ad impression with ZK proof
   */
  async saveImpression(impression: Omit<AdImpression, 'id' | 'timestamp'>): Promise<string> {
    const id = `impression_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = new Date();

    if (this.useInMemory()) {
      this.inMemoryImpressions.push({
        id,
        adId: impression.adId,
        contentId: impression.contentId,
        zkProof: impression.zkProof,
        proofHash: impression.proofHash,
        encryptedViewer: impression.encryptedViewer,
        blockHeader: impression.blockHeader,
        timestamp,
        merklePath: impression.merklePath,
        merkleIndex: impression.merkleIndex,
        verified: impression.verified || false,
        settled: false,
        settledAt: undefined,
        revenueDistributed: false,
        walrusDrawdownUsed: false,
        walrusDrawdownUsedAt: undefined,
        walrusDrawdownPending: false,
        walrusDrawdownPendingAt: undefined
      });
      return id;
    }

    const mutation = {
      set: {
        uid: `_:${id}`,
        dgraph_type: 'AdImpression',
        id,
        adId: impression.adId,
        contentId: impression.contentId,
        zkProof: impression.zkProof,
        proofHash: impression.proofHash,
        encryptedViewer: impression.encryptedViewer,
        blockHeader: impression.blockHeader,
        timestamp: timestamp.toISOString(),
        merklePath: impression.merklePath || '',
        merkleIndex: impression.merkleIndex || 0,
        verified: impression.verified || false,
        settled: false,
        revenueDistributed: false,
        walrusDrawdownUsed: false
      }
    };

    try {
      await dgraphClient.mutate(mutation);
      logger.info('Saved ad impression', { id, adId: impression.adId, contentId: impression.contentId });
      return id;
    } catch (error) {
      logger.error('Failed to save ad impression', error);
      throw error;
    }
  }

  /**
   * Find impressions by content ID
   */
  async findByContentId(contentId: string): Promise<AdImpression[]> {
    if (this.useInMemory()) {
      return this.inMemoryImpressions
        .filter(imp => imp.contentId === contentId)
        .map(imp => ({ ...imp, timestamp: new Date(imp.timestamp) }));
    }
    const query = `
      query impressions($contentId: string) {
        impressions(func: eq(contentId, $contentId)) @filter(type(AdImpression)) {
          uid
          id
          adId
          contentId
          zkProof
          proofHash
          encryptedViewer
          blockHeader
          timestamp
          merklePath
          merkleIndex
          verified
        }
      }
    `;

    try {
      const result = await dgraphClient.query(query, { $contentId: contentId });
      return (result.impressions || []).map((imp: any) => ({
        ...imp,
        timestamp: new Date(imp.timestamp),
        merkleIndex: imp.merkleIndex || 0
      }));
    } catch (error) {
      logger.error('Failed to find impressions by content ID', { contentId, error });
      throw error;
    }
  }

  /**
   * Find impressions by ad ID
   */
  async findByAdId(adId: string): Promise<AdImpression[]> {
    if (this.useInMemory()) {
      return this.inMemoryImpressions
        .filter(imp => imp.adId === adId)
        .map(imp => ({ ...imp, timestamp: new Date(imp.timestamp) }));
    }
    const query = `
      query impressions($adId: string) {
        impressions(func: eq(adId, $adId)) @filter(type(AdImpression)) {
          uid
          id
          adId
          contentId
          zkProof
          proofHash
          encryptedViewer
          blockHeader
          timestamp
          merklePath
          merkleIndex
          verified
        }
      }
    `;

    try {
      const result = await dgraphClient.query(query, { $adId: adId });
      return (result.impressions || []).map((imp: any) => ({
        ...imp,
        timestamp: new Date(imp.timestamp),
        merkleIndex: imp.merkleIndex || 0
      }));
    } catch (error) {
      logger.error('Failed to find impressions by ad ID', { adId, error });
      throw error;
    }
  }

  /**
   * Count impressions for content (for threshold checking)
   */
  async countByContentId(contentId: string): Promise<number> {
    if (this.useInMemory()) {
      return this.inMemoryImpressions.filter(imp => imp.contentId === contentId).length;
    }
    const query = `
      query count($contentId: string) {
        count(func: eq(contentId, $contentId)) @filter(type(AdImpression)) {
          count(uid)
        }
      }
    `;

    try {
      const result = await dgraphClient.query(query, { $contentId: contentId });
      return result.count?.[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count impressions', { contentId, error });
      throw error;
    }
  }

  /**
   * Update impression with Merkle tree path
   */
  async updateMerklePath(uid: string, merklePath: string, merkleIndex: number): Promise<void> {
    if (this.useInMemory()) {
      const match = this.inMemoryImpressions.find(imp => imp.id === uid);
      if (match) {
        match.merklePath = merklePath;
        match.merkleIndex = merkleIndex;
      }
      return;
    }
    const mutation = {
      set: {
        uid,
        merklePath,
        merkleIndex
      }
    };

    try {
      await dgraphClient.mutate(mutation);
      logger.info('Updated impression Merkle path', { uid, merkleIndex });
    } catch (error) {
      logger.error('Failed to update Merkle path', { uid, error });
      throw error;
    }
  }

  /**
   * Save or update ad aggregate
   */
  async saveAggregate(aggregate: Omit<AdAggregate, 'id'>): Promise<string> {
    const id = `aggregate_${aggregate.adId}_${aggregate.contentId}`;

    if (this.useInMemory()) {
      const existingIdx = this.inMemoryAggregates.findIndex(a => a.id === id);
      const row: AdAggregate = {
        id,
        adId: aggregate.adId,
        contentId: aggregate.contentId,
        encryptedCount: aggregate.encryptedCount,
        merkleRoot: aggregate.merkleRoot,
        threshold: aggregate.threshold,
        currentCount: aggregate.currentCount,
        reachedAt: aggregate.reachedAt,
        distributed: aggregate.distributed || false
      };
      if (existingIdx >= 0) this.inMemoryAggregates[existingIdx] = row;
      else this.inMemoryAggregates.push(row);
      return id;
    }

    const mutation = {
      set: {
        uid: `_:${id}`,
        dgraph_type: 'AdAggregate',
        id,
        adId: aggregate.adId,
        contentId: aggregate.contentId,
        encryptedCount: aggregate.encryptedCount,
        merkleRoot: aggregate.merkleRoot,
        threshold: aggregate.threshold,
        currentCount: aggregate.currentCount,
        reachedAt: aggregate.reachedAt?.toISOString() || '',
        distributed: aggregate.distributed || false
      }
    };

    try {
      await dgraphClient.mutate(mutation);
      logger.info('Saved ad aggregate', { id, adId: aggregate.adId, contentId: aggregate.contentId });
      return id;
    } catch (error) {
      logger.error('Failed to save ad aggregate', error);
      throw error;
    }
  }

  /**
   * Find aggregate by content ID
   */
  async findAggregateByContentId(contentId: string): Promise<AdAggregate | null> {
    if (this.useInMemory()) {
      const agg = this.inMemoryAggregates.find(a => a.contentId === contentId);
      return agg ? { ...agg } : null;
    }
    const query = `
      query aggregate($contentId: string) {
        aggregate(func: eq(contentId, $contentId)) @filter(type(AdAggregate)) {
          id
          adId
          contentId
          encryptedCount
          merkleRoot
          threshold
          currentCount
          reachedAt
          distributed
        }
      }
    `;

    try {
      const result = await dgraphClient.query(query, { $contentId: contentId });
      const agg = result.aggregate?.[0];
      if (!agg) return null;

      return {
        ...agg,
        reachedAt: agg.reachedAt ? new Date(agg.reachedAt) : undefined
      };
    } catch (error) {
      logger.error('Failed to find aggregate by content ID', { contentId, error });
      throw error;
    }
  }

  /**
   * Clear test data (for testing)
   */
  clearTestData(): void {
    if (!this.isTest()) return;
    this.inMemoryImpressions = [];
    this.inMemoryAggregates = [];
  }

  async findById(id: string): Promise<AdImpression | null> {
    if (this.useInMemory()) {
      const imp = this.inMemoryImpressions.find(i => i.id === id);
      return imp ? { ...imp, timestamp: new Date(imp.timestamp) } : null;
    }

    const query = `
      query impression($id: string) {
        impressions(func: eq(id, $id)) @filter(type(AdImpression)) {
          uid
          id
          adId
          contentId
          zkProof
          proofHash
          encryptedViewer
          blockHeader
          timestamp
          merklePath
          merkleIndex
          verified
        }
      }
    `;
    const result = await dgraphClient.query(query, { $id: id });
    const imp = result.impressions?.[0];
    if (!imp) return null;
    return {
      ...imp,
      timestamp: new Date(imp.timestamp),
      merkleIndex: imp.merkleIndex || 0
    };
  }

  async list(filters?: {
    adId?: string;
    contentId?: string;
    verified?: boolean;
    settled?: boolean;
    revenueDistributed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ impressions: AdImpression[]; total: number }> {
    const limit = Math.max(1, Math.min(100, Number(filters?.limit ?? 50)));
    const offset = Math.max(0, Number(filters?.offset ?? 0));

    if (this.useInMemory()) {
      let rows = [...this.inMemoryImpressions];
      if (filters?.adId) rows = rows.filter(r => r.adId === filters.adId);
      if (filters?.contentId) rows = rows.filter(r => r.contentId === filters.contentId);
      if (typeof filters?.verified === 'boolean') rows = rows.filter(r => r.verified === filters.verified);
      if (typeof filters?.settled === 'boolean') rows = rows.filter(r => (r.settled ?? false) === filters.settled);
      if (typeof filters?.revenueDistributed === 'boolean') rows = rows.filter(r => (r.revenueDistributed ?? false) === filters.revenueDistributed);
      const total = rows.length;
      rows = rows
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(offset, offset + limit);
      return { impressions: rows.map(r => ({ ...r })), total };
    }

    // MVP: fetch by filters using @filter expression
    const clauses: string[] = ['type(AdImpression)'];
    if (filters?.adId) clauses.push('eq(adId, $adId)');
    if (filters?.contentId) clauses.push('eq(contentId, $contentId)');
    if (typeof filters?.verified === 'boolean') clauses.push(`eq(verified, ${filters.verified})`);
    if (typeof filters?.settled === 'boolean') clauses.push(`eq(settled, ${filters.settled})`);
    if (typeof filters?.revenueDistributed === 'boolean') clauses.push(`eq(revenueDistributed, ${filters.revenueDistributed})`);
    const filterExpr = clauses.length ? `@filter(${clauses.join(' AND ')})` : '';

    const query = `
      query impressions($adId: string, $contentId: string, $limit: int, $offset: int) {
        impressions(func: type(AdImpression), first: $limit, offset: $offset) ${filterExpr} {
          id
          uid
          adId
          contentId
          proofHash
          blockHeader
          timestamp
          merklePath
          merkleIndex
          verified
          settled
          settledAt
          revenueDistributed
        }
        total(func: type(AdImpression)) ${filterExpr} {
          count(uid)
        }
      }
    `;

    const result = await dgraphClient.query(query, {
      $adId: filters?.adId || '',
      $contentId: filters?.contentId || '',
      $limit: limit,
      $offset: offset
    });

    const impressions: AdImpression[] = (result.impressions || []).map((imp: any) => ({
      ...imp,
      zkProof: '',
      encryptedViewer: '',
      timestamp: new Date(imp.timestamp),
      merkleIndex: imp.merkleIndex || 0,
      settled: imp.settled ?? false,
      settledAt: imp.settledAt ? new Date(imp.settledAt) : undefined,
      revenueDistributed: imp.revenueDistributed ?? false
    }));
    const total = result.total?.[0]?.count || 0;
    return { impressions, total };
  }

  /** Mark impressions as settled (after on-chain record_impression_with_escrow). Prevents double-spend. */
  async markSettled(impressionIds: string[]): Promise<void> {
    if (impressionIds.length === 0) return;
    const now = new Date();

    if (this.useInMemory()) {
      for (const id of impressionIds) {
        const imp = this.inMemoryImpressions.find(i => i.id === id);
        if (imp) {
          imp.settled = true;
          imp.settledAt = now;
        }
      }
      return;
    }

    for (const id of impressionIds) {
      const q = `
        query impression($id: string) {
          impressions(func: eq(id, $id)) @filter(type(AdImpression)) {
            uid
          }
        }
      `;
      const result = await dgraphClient.query(q, { $id: id });
      const uid = result.impressions?.[0]?.uid;
      if (!uid) continue;
      await dgraphClient.mutate({
        set: {
          uid,
          settled: true,
          settledAt: now.toISOString()
        }
      });
    }
  }

  /** Mark impressions as revenue-distributed (after distribute_revenue). Prevents double payout. */
  async markRevenueDistributed(impressionIds: string[]): Promise<void> {
    if (impressionIds.length === 0) return;

    if (this.useInMemory()) {
      for (const id of impressionIds) {
        const imp = this.inMemoryImpressions.find(i => i.id === id);
        if (imp) imp.revenueDistributed = true;
      }
      return;
    }

    for (const id of impressionIds) {
      const q = `
        query impression($id: string) {
          impressions(func: eq(id, $id)) @filter(type(AdImpression)) {
            uid
          }
        }
      `;
      const result = await dgraphClient.query(q, { $id: id });
      const uid = result.impressions?.[0]?.uid;
      if (!uid) continue;
      await dgraphClient.mutate({
        set: { uid, revenueDistributed: true }
      });
    }
  }

  async setVerified(id: string, verified: boolean): Promise<boolean> {
    if (this.useInMemory()) {
      const imp = this.inMemoryImpressions.find(i => i.id === id);
      if (!imp) return false;
      imp.verified = verified;
      return true;
    }

    const query = `
      query impression($id: string) {
        impressions(func: eq(id, $id)) @filter(type(AdImpression)) {
          uid
        }
      }
    `;
    const result = await dgraphClient.query(query, { $id: id });
    const uid = result.impressions?.[0]?.uid;
    if (!uid) return false;

    await dgraphClient.mutate({
      set: {
        uid,
        verified
      }
    });
    return true;
  }

  /**
   * Mark proof hashes as used in Walrus drawdown (prevents double-spend)
   */
  async markWalrusDrawdownUsed(proofHashes: string[]): Promise<void> {
    if (proofHashes.length === 0) return;
    const now = new Date();

    if (this.useInMemory()) {
      for (const proofHash of proofHashes) {
        const imp = this.inMemoryImpressions.find(i => i.proofHash === proofHash);
        if (imp) {
          imp.walrusDrawdownUsed = true;
          imp.walrusDrawdownUsedAt = now;
        }
      }
      return;
    }

    for (const proofHash of proofHashes) {
      const query = `
        query impression($proofHash: string) {
          impressions(func: eq(proofHash, $proofHash)) @filter(type(AdImpression)) {
            uid
          }
        }
      `;
      const result = await dgraphClient.query(query, { $proofHash: proofHash });
      const uid = result.impressions?.[0]?.uid;
      if (!uid) continue;

      await dgraphClient.mutate({
        set: {
          uid,
          walrusDrawdownUsed: true,
          walrusDrawdownUsedAt: now.toISOString()
        }
      });
    }
  }

  /**
   * Find impression by proof hash with Merkle proof data
   */
  async findByProofHash(proofHash: string): Promise<AdImpression | null> {
    if (this.useInMemory()) {
      return this.inMemoryImpressions.find(i => i.proofHash === proofHash) || null;
    }

    const query = `
      query impression($proofHash: string) {
        impressions(func: eq(proofHash, $proofHash)) @filter(type(AdImpression)) {
          uid
          id
          adId
          contentId
          zkProof
          proofHash
          encryptedViewer
          blockHeader
          timestamp
          merklePath
          merkleIndex
          verified
          settled
          settledAt
          revenueDistributed
          walrusDrawdownUsed
          walrusDrawdownUsedAt
        }
      }
    `;
    const result = await dgraphClient.query(query, { $proofHash: proofHash });
    const imp = result.impressions?.[0];
    if (!imp) return null;

    return {
      uid: imp.uid,
      id: imp.id,
      adId: imp.adId,
      contentId: imp.contentId,
      zkProof: imp.zkProof,
      proofHash: imp.proofHash,
      encryptedViewer: imp.encryptedViewer,
      blockHeader: imp.blockHeader,
      timestamp: new Date(imp.timestamp),
      merklePath: imp.merklePath || undefined,
      merkleIndex: imp.merkleIndex || undefined,
      verified: imp.verified ?? false,
      settled: imp.settled ?? false,
      settledAt: imp.settledAt ? new Date(imp.settledAt) : undefined,
      revenueDistributed: imp.revenueDistributed ?? false,
      walrusDrawdownUsed: imp.walrusDrawdownUsed ?? false,
      walrusDrawdownUsedAt: imp.walrusDrawdownUsedAt ? new Date(imp.walrusDrawdownUsedAt) : undefined
    };
  }

  /**
   * Check if proof hashes are already used in Walrus drawdown
   */
  async checkWalrusDrawdownUsed(proofHashes: string[]): Promise<{ used: string[]; unused: string[] }> {
    const used: string[] = [];
    const unused: string[] = [];

    for (const proofHash of proofHashes) {
      const imp = await this.findByProofHash(proofHash);
      if (imp?.walrusDrawdownUsed) {
        used.push(proofHash);
      } else {
        unused.push(proofHash);
      }
    }

    return { used, unused };
  }

  /**
   * Queue proofs for Walrus drawdown (off-chain batch processing)
   */
  async queueWalrusDrawdown(proofHashes: string[]): Promise<void> {
    if (proofHashes.length === 0) return;
    const now = new Date();

    if (this.useInMemory()) {
      for (const proofHash of proofHashes) {
        const imp = this.inMemoryImpressions.find(i => i.proofHash === proofHash);
        if (imp && !imp.walrusDrawdownUsed && !imp.walrusDrawdownPending) {
          imp.walrusDrawdownPending = true;
          imp.walrusDrawdownPendingAt = now;
        }
      }
      return;
    }

    for (const proofHash of proofHashes) {
      const query = `
        query impression($proofHash: string) {
          impressions(func: eq(proofHash, $proofHash)) @filter(type(AdImpression)) {
            uid
            walrusDrawdownUsed
            walrusDrawdownPending
          }
        }
      `;
      const result = await dgraphClient.query(query, { $proofHash: proofHash });
      const imp = result.impressions?.[0];
      if (!imp || imp.walrusDrawdownUsed || imp.walrusDrawdownPending) continue;

      await dgraphClient.mutate({
        set: {
          uid: imp.uid,
          walrusDrawdownPending: true,
          walrusDrawdownPendingAt: now.toISOString()
        }
      });
    }
  }

  /**
   * Get pending drawdowns grouped by contentId
   */
  async getPendingDrawdowns(): Promise<Array<{
    contentId: string;
    proofHashes: string[];
    impressions: AdImpression[];
  }>> {
    if (this.useInMemory()) {
      const pending = this.inMemoryImpressions.filter(
        imp => imp.walrusDrawdownPending && !imp.walrusDrawdownUsed && imp.verified
      );
      const grouped = new Map<string, AdImpression[]>();
      for (const imp of pending) {
        if (!grouped.has(imp.contentId)) {
          grouped.set(imp.contentId, []);
        }
        grouped.get(imp.contentId)!.push(imp);
      }
      return Array.from(grouped.entries()).map(([contentId, impressions]) => ({
        contentId,
        proofHashes: impressions.map(i => i.proofHash),
        impressions
      }));
    }

    const query = `
      query pending {
        pending(func: eq(walrusDrawdownPending, true)) @filter(type(AdImpression) AND eq(verified, true) AND eq(walrusDrawdownUsed, false)) {
          uid
          id
          adId
          contentId
          proofHash
          zkProof
          encryptedViewer
          blockHeader
          timestamp
          merklePath
          merkleIndex
          verified
          walrusDrawdownPending
          walrusDrawdownPendingAt
        }
      }
    `;

    try {
      const result = await dgraphClient.query(query);
      const impressions = (result.pending || []).map((imp: any) => ({
        uid: imp.uid,
        id: imp.id,
        adId: imp.adId,
        contentId: imp.contentId,
        proofHash: imp.proofHash,
        zkProof: imp.zkProof,
        encryptedViewer: imp.encryptedViewer,
        blockHeader: imp.blockHeader,
        timestamp: new Date(imp.timestamp),
        merklePath: imp.merklePath || undefined,
        merkleIndex: imp.merkleIndex || undefined,
        verified: imp.verified ?? false,
        walrusDrawdownPending: true,
        walrusDrawdownPendingAt: imp.walrusDrawdownPendingAt ? new Date(imp.walrusDrawdownPendingAt) : undefined
      }));

      // Group by contentId
      const grouped = new Map<string, AdImpression[]>();
      for (const imp of impressions) {
        if (!grouped.has(imp.contentId)) {
          grouped.set(imp.contentId, []);
        }
        grouped.get(imp.contentId)!.push(imp);
      }

      return Array.from(grouped.entries()).map(([contentId, imps]) => ({
        contentId,
        proofHashes: imps.map(i => i.proofHash),
        impressions: imps
      }));
    } catch (error) {
      logger.error('Failed to get pending drawdowns', error);
      throw error;
    }
  }

  /**
   * Mark drawdowns as completed (used) after batch processing
   */
  async markDrawdownsCompleted(proofHashes: string[]): Promise<void> {
    if (proofHashes.length === 0) return;
    const now = new Date();

    if (this.useInMemory()) {
      for (const proofHash of proofHashes) {
        const imp = this.inMemoryImpressions.find(i => i.proofHash === proofHash);
        if (imp) {
          imp.walrusDrawdownUsed = true;
          imp.walrusDrawdownUsedAt = now;
          imp.walrusDrawdownPending = false;
        }
      }
      return;
    }

    for (const proofHash of proofHashes) {
      const query = `
        query impression($proofHash: string) {
          impressions(func: eq(proofHash, $proofHash)) @filter(type(AdImpression)) {
            uid
          }
        }
      `;
      const result = await dgraphClient.query(query, { $proofHash: proofHash });
      const uid = result.impressions?.[0]?.uid;
      if (!uid) continue;

      await dgraphClient.mutate({
        set: {
          uid,
          walrusDrawdownUsed: true,
          walrusDrawdownUsedAt: now.toISOString(),
          walrusDrawdownPending: false
        }
      });
    }
  }
}

export const impressionRepository = new ImpressionRepository();
