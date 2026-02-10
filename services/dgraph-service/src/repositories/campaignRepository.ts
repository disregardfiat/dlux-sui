import { dgraphClient } from '../dgraph/client';
import { logger } from '../utils/logger';

export type CampaignStatus = 'active' | 'paused' | 'cancelled';

export type AdCampaign = {
  id: string;
  advertiser: string;
  title: string;
  description?: string;
  targetUrl: string;
  placements: string[];
  contentIds?: string[];
  bid: number; // max bid per impression (SUI, MVP float)
  totalBudget: number;
  remainingBudget: number;
  startAt?: Date;
  endAt?: Date;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
  /** SUI object ID of AdCampaign (for settlement). When set, settlement uses this + onChainEscrowId. */
  onChainCampaignId?: string;
  /** SUI object ID of CampaignEscrow (for settlement). */
  onChainEscrowId?: string;
};

export type CreateCampaignInput = Omit<
  AdCampaign,
  'id' | 'remainingBudget' | 'status' | 'createdAt' | 'updatedAt'
> & {
  status?: CampaignStatus;
};

export type UpdateCampaignInput = Partial<
  Omit<AdCampaign, 'id' | 'advertiser' | 'createdAt' | 'updatedAt'>
>;

const isTest = () => process.env.NODE_ENV === 'test';

// Check if DGraph is available (for in-memory fallback)
function isDGraphAvailable(): boolean {
  try {
    dgraphClient.getClient();
    return true;
  } catch {
    return false;
  }
}

export class CampaignRepository {
  private inMemory = new Map<string, AdCampaign>();

  clearTestData() {
    if (!isTest()) return;
    this.inMemory.clear();
  }

  // Use in-memory mode if DGraph not available or in test mode
  private useInMemory(): boolean {
    return isTest() || !isDGraphAvailable();
  }

  async create(input: CreateCampaignInput): Promise<AdCampaign> {
    const now = new Date();
    const id = `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const campaign: AdCampaign = {
      id,
      advertiser: input.advertiser,
      title: input.title,
      description: input.description,
      targetUrl: input.targetUrl,
      placements: input.placements,
      contentIds: input.contentIds,
      bid: input.bid,
      totalBudget: input.totalBudget,
      remainingBudget: input.totalBudget,
      startAt: input.startAt,
      endAt: input.endAt,
      status: input.status || 'active',
      createdAt: now,
      updatedAt: now,
      onChainCampaignId: (input as any).onChainCampaignId,
      onChainEscrowId: (input as any).onChainEscrowId
    };

    if (this.useInMemory()) {
      this.inMemory.set(id, campaign);
      return campaign;
    }

    const mutation: { set: Record<string, unknown> } = {
      set: {
        uid: `_:${id}`,
        dgraph_type: 'AdCampaign',
        id,
        advertiser: campaign.advertiser,
        title: campaign.title,
        description: campaign.description || '',
        targetUrl: campaign.targetUrl,
        placements: campaign.placements,
        contentIds: campaign.contentIds || [],
        bid: campaign.bid,
        totalBudget: campaign.totalBudget,
        remainingBudget: campaign.remainingBudget,
        startAt: campaign.startAt ? campaign.startAt.toISOString() : '',
        endAt: campaign.endAt ? campaign.endAt.toISOString() : '',
        status: campaign.status,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString()
      }
    };
    if (campaign.onChainCampaignId) mutation.set.onChainCampaignId = campaign.onChainCampaignId;
    if (campaign.onChainEscrowId) mutation.set.onChainEscrowId = campaign.onChainEscrowId;

    await dgraphClient.mutate(mutation);
    return campaign;
  }

  async getById(id: string): Promise<AdCampaign | null> {
    if (this.useInMemory()) return this.inMemory.get(id) || null;

    const query = `
      query campaign($id: string) {
        campaigns(func: eq(id, $id)) @filter(type(AdCampaign)) {
          id
          advertiser
          title
          description
          targetUrl
          placements
          contentIds
          bid
          totalBudget
          remainingBudget
          startAt
          endAt
          status
          createdAt
          updatedAt
          onChainCampaignId
          onChainEscrowId
        }
      }
    `;

    const result = await dgraphClient.query(query, { $id: id });
    const row = result.campaigns?.[0];
    if (!row) return null;
    return this.hydrate(row);
  }

  async list(filters?: {
    advertiser?: string;
    status?: CampaignStatus;
    placement?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ campaigns: AdCampaign[]; total: number }> {
    const limit = Math.max(1, Math.min(100, Number(filters?.limit ?? 50)));
    const offset = Math.max(0, Number(filters?.offset ?? 0));

    if (this.useInMemory()) {
      let campaigns = Array.from(this.inMemory.values());
      if (filters?.advertiser) campaigns = campaigns.filter(c => c.advertiser === filters.advertiser);
      if (filters?.status) campaigns = campaigns.filter(c => c.status === filters.status);
      if (filters?.activeOnly) campaigns = campaigns.filter(c => c.status === 'active');
      if (filters?.placement) campaigns = campaigns.filter(c => c.placements.includes(filters.placement!));
      const total = campaigns.length;
      campaigns = campaigns
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(offset, offset + limit);
      return { campaigns, total };
    }

    // MVP query: pull all campaigns and filter in memory. (Acceptable while small.)
    // If this grows, optimize using Dgraph @filter expressions.
    const query = `
      query campaigns {
        campaigns(func: type(AdCampaign)) {
          id
          advertiser
          title
          description
          targetUrl
          placements
          contentIds
          bid
          totalBudget
          remainingBudget
          startAt
          endAt
          status
          createdAt
          updatedAt
          onChainCampaignId
          onChainEscrowId
        }
      }
    `;
    const result = await dgraphClient.query(query);
    let campaigns: AdCampaign[] = (result.campaigns || []).map((row: any) => this.hydrate(row));
    if (filters?.advertiser) campaigns = campaigns.filter(c => c.advertiser === filters.advertiser);
    if (filters?.status) campaigns = campaigns.filter(c => c.status === filters.status);
    if (filters?.activeOnly) campaigns = campaigns.filter(c => c.status === 'active');
    if (filters?.placement) campaigns = campaigns.filter(c => c.placements.includes(filters.placement!));
    const total = campaigns.length;
    campaigns = campaigns
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
    return { campaigns, total };
  }

  async update(id: string, patch: UpdateCampaignInput): Promise<AdCampaign | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updated: AdCampaign = {
      ...existing,
      ...patch,
      placements: patch.placements ?? existing.placements,
      updatedAt: new Date()
    };

    if (this.useInMemory()) {
      this.inMemory.set(id, updated);
      return updated;
    }

    const mutation: { set: Record<string, unknown> } = {
      set: {
        uid: `_:${id}`,
        id,
        title: updated.title,
        description: updated.description || '',
        targetUrl: updated.targetUrl,
        placements: updated.placements,
        contentIds: updated.contentIds || [],
        bid: updated.bid,
        totalBudget: updated.totalBudget,
        remainingBudget: updated.remainingBudget,
        startAt: updated.startAt ? updated.startAt.toISOString() : '',
        endAt: updated.endAt ? updated.endAt.toISOString() : '',
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString()
      }
    };
    if (updated.onChainCampaignId !== undefined) mutation.set.onChainCampaignId = updated.onChainCampaignId || '';
    if (updated.onChainEscrowId !== undefined) mutation.set.onChainEscrowId = updated.onChainEscrowId || '';

    try {
      await dgraphClient.mutate(mutation);
    } catch (error) {
      logger.error('Failed to update campaign', error);
      throw error;
    }

    return updated;
  }

  async setStatus(id: string, status: CampaignStatus): Promise<AdCampaign | null> {
    return this.update(id, { status });
  }

  async spend(id: string, amount: number): Promise<AdCampaign | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const nextRemaining = Math.max(0, existing.remainingBudget - amount);
    return this.update(id, { remainingBudget: nextRemaining });
  }

  private hydrate(row: any): AdCampaign {
    return {
      id: row.id,
      advertiser: row.advertiser,
      title: row.title,
      description: row.description || undefined,
      targetUrl: row.targetUrl,
      placements: Array.isArray(row.placements) ? row.placements : [],
      contentIds: Array.isArray(row.contentIds) ? row.contentIds : [],
      bid: Number(row.bid || 0),
      totalBudget: Number(row.totalBudget || 0),
      remainingBudget: Number(row.remainingBudget || 0),
      startAt: row.startAt ? new Date(row.startAt) : undefined,
      endAt: row.endAt ? new Date(row.endAt) : undefined,
      status: (row.status || 'active') as CampaignStatus,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      onChainCampaignId: row.onChainCampaignId || undefined,
      onChainEscrowId: row.onChainEscrowId || undefined
    };
  }
}

export const campaignRepository = new CampaignRepository();

