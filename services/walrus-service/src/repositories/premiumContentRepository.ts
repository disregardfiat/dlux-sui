import { logger } from '../utils/logger';

export interface PremiumContent {
  id: string;
  name: string;
  description: string;
  price: number; // SUI amount
  contentType: string;
  originalSize: number;
  owner: string;
  dappId: string;
  sealObjectId: string;
  sealPackage: any;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface PremiumPurchase {
  id: string;
  contentId: string;
  buyer: string;
  paymentTxId: string;
  accessGrantId: string;
  price: number;
  creatorShare: number;
  platformFee: number;
  foundationAddress: string;
  purchasedAt: Date;
  content?: PremiumContent; // Populated when needed
}

// In-memory storage - replace with database in production
const premiumContents = new Map<string, PremiumContent>();
const purchases = new Map<string, PremiumPurchase>();

export class PremiumContentRepository {
  async create(content: Omit<PremiumContent, 'id' | 'createdAt' | 'updatedAt'>): Promise<PremiumContent> {
    const id = `premium_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const premiumContent: PremiumContent = {
      ...content,
      id,
      createdAt: now,
      updatedAt: now
    };

    premiumContents.set(id, premiumContent);
    logger.debug('Premium content created', { id, name: content.name, owner: content.owner });

    return premiumContent;
  }

  async findById(id: string): Promise<PremiumContent | null> {
    return premiumContents.get(id) || null;
  }

  async findByDApp(dappId: string): Promise<PremiumContent[]> {
    return Array.from(premiumContents.values())
      .filter(content => content.dappId === dappId && content.status === 'active')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByOwner(owner: string): Promise<PremiumContent[]> {
    return Array.from(premiumContents.values())
      .filter(content => content.owner === owner)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findPurchasesByContent(contentId: string): Promise<PremiumPurchase[]> {
    return Array.from(purchases.values())
      .filter(purchase => purchase.contentId === contentId)
      .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
  }

  async update(id: string, updates: Partial<PremiumContent>): Promise<PremiumContent | null> {
    const content = premiumContents.get(id);
    if (!content) return null;

    const updated = { ...content, ...updates, updatedAt: new Date() };
    premiumContents.set(id, updated);

    logger.debug('Premium content updated', { id, updates });
    return updated;
  }

  async delete(id: string): Promise<void> {
    premiumContents.delete(id);
    logger.debug('Premium content deleted', { id });
  }

  async recordPurchase(purchase: Omit<PremiumPurchase, 'id' | 'purchasedAt'>): Promise<PremiumPurchase> {
    const id = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const purchaseRecord: PremiumPurchase = {
      ...purchase,
      id,
      purchasedAt: now
    };

    purchases.set(id, purchaseRecord);
    logger.debug('Purchase recorded', {
      id,
      contentId: purchase.contentId,
      buyer: purchase.buyer,
      price: purchase.price,
      creatorShare: purchase.creatorShare,
      platformFee: purchase.platformFee
    });

    return purchaseRecord;
  }

  async findPurchasesByUser(buyer: string): Promise<PremiumPurchase[]> {
    const userPurchases = Array.from(purchases.values())
      .filter(purchase => purchase.buyer === buyer)
      .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());

    // Populate content data
    return userPurchases.map(purchase => ({
      ...purchase,
      content: premiumContents.get(purchase.contentId) || undefined
    }));
  }

  async findPurchaseById(id: string): Promise<PremiumPurchase | null> {
    const purchase = purchases.get(id);
    if (!purchase) return null;

    return {
      ...purchase,
      content: premiumContents.get(purchase.contentId) || undefined
    };
  }

  async getStats(): Promise<{
    totalContents: number;
    totalPurchases: number;
    totalRevenue: number;
    activeContents: number;
  }> {
    const allContents = Array.from(premiumContents.values());
    const allPurchases = Array.from(purchases.values());

    return {
      totalContents: allContents.length,
      totalPurchases: allPurchases.length,
      totalRevenue: allPurchases.reduce((sum, p) => sum + p.price, 0),
      activeContents: allContents.filter(c => c.status === 'active').length
    };
  }

  // Clear test data (for testing only)
  async clearTestData(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('clearTestData can only be called in test environment');
    }

    premiumContents.clear();
    purchases.clear();
  }
}

export const premiumContentRepository = new PremiumContentRepository();