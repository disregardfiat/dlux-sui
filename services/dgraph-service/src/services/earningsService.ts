/**
 * Earnings tracking service with 4-bucket rolling window.
 * 
 * Buckets: 1=0-30d (current), 2=31-60d, 3=61-90d, 4=91-120d
 * Rolling window (90d) = buckets 2+3+4
 * After 120d, bucket 4 → allTimeTotal, then cleared.
 */

import { dgraphClient } from '../dgraph/client';
import { logger } from '../utils/logger';

const BUCKET_DAYS = 30;
const ROLLING_WINDOW_DAYS = 90; // buckets 2+3+4

interface EarningsLedger {
  pmBucket1: number;
  pmBucket2: number;
  pmBucket3: number;
  pmBucket4: number;
  pmAllTime: number;
  adBucket1: number;
  adBucket2: number;
  adBucket3: number;
  adBucket4: number;
  adAllTime: number;
  lastRollDate: Date | null;
  updatedAt: Date;
}

export class EarningsService {
  /**
   * Get or create a dApp earnings ledger
   */
  async getOrCreateDAppLedger(dappId: string): Promise<EarningsLedger> {
    const query = `
      query dappLedger($dappId: string) {
        ledger(func: eq(dappId, $dappId)) @filter(type(DAppEarningsLedger)) {
          dappId
          pmBucket1 pmBucket2 pmBucket3 pmBucket4 pmAllTime
          adBucket1 adBucket2 adBucket3 adBucket4 adAllTime
          lastRollDate updatedAt
        }
      }
    `;
    const result = await dgraphClient.query(query, { $dappId: dappId });
    const existing = result.ledger?.[0];
    
    if (existing) {
      return {
        pmBucket1: existing.pmBucket1 || 0,
        pmBucket2: existing.pmBucket2 || 0,
        pmBucket3: existing.pmBucket3 || 0,
        pmBucket4: existing.pmBucket4 || 0,
        pmAllTime: existing.pmAllTime || 0,
        adBucket1: existing.adBucket1 || 0,
        adBucket2: existing.adBucket2 || 0,
        adBucket3: existing.adBucket3 || 0,
        adBucket4: existing.adBucket4 || 0,
        adAllTime: existing.adAllTime || 0,
        lastRollDate: existing.lastRollDate ? new Date(existing.lastRollDate) : null,
        updatedAt: existing.updatedAt ? new Date(existing.updatedAt) : new Date()
      };
    }

    // Create new ledger
    const now = new Date();
    const mutation = {
      set: {
        uid: `_:ledger_dapp_${dappId}`,
        dgraph_type: 'DAppEarningsLedger',
        dappId,
        pmBucket1: 0,
        pmBucket2: 0,
        pmBucket3: 0,
        pmBucket4: 0,
        pmAllTime: 0,
        adBucket1: 0,
        adBucket2: 0,
        adBucket3: 0,
        adBucket4: 0,
        adAllTime: 0,
        lastRollDate: null,
        updatedAt: now.toISOString()
      }
    };
    await dgraphClient.mutate(mutation);
    
    return {
      pmBucket1: 0, pmBucket2: 0, pmBucket3: 0, pmBucket4: 0, pmAllTime: 0,
      adBucket1: 0, adBucket2: 0, adBucket3: 0, adBucket4: 0, adAllTime: 0,
      lastRollDate: null,
      updatedAt: now
    };
  }

  /**
   * Get or create an account earnings ledger
   */
  async getOrCreateAccountLedger(account: string): Promise<EarningsLedger> {
    const query = `
      query accountLedger($account: string) {
        ledger(func: eq(account, $account)) @filter(type(AccountEarningsLedger)) {
          account
          pmBucket1 pmBucket2 pmBucket3 pmBucket4 pmAllTime
          adBucket1 adBucket2 adBucket3 adBucket4 adAllTime
          lastRollDate updatedAt
        }
      }
    `;
    const result = await dgraphClient.query(query, { $account: account });
    const existing = result.ledger?.[0];
    
    if (existing) {
      return {
        pmBucket1: existing.pmBucket1 || 0,
        pmBucket2: existing.pmBucket2 || 0,
        pmBucket3: existing.pmBucket3 || 0,
        pmBucket4: existing.pmBucket4 || 0,
        pmAllTime: existing.pmAllTime || 0,
        adBucket1: existing.adBucket1 || 0,
        adBucket2: existing.adBucket2 || 0,
        adBucket3: existing.adBucket3 || 0,
        adBucket4: existing.adBucket4 || 0,
        adAllTime: existing.adAllTime || 0,
        lastRollDate: existing.lastRollDate ? new Date(existing.lastRollDate) : null,
        updatedAt: existing.updatedAt ? new Date(existing.updatedAt) : new Date()
      };
    }

    // Create new ledger
    const now = new Date();
    const mutation = {
      set: {
        uid: `_:ledger_account_${account}`,
        dgraph_type: 'AccountEarningsLedger',
        account,
        pmBucket1: 0,
        pmBucket2: 0,
        pmBucket3: 0,
        pmBucket4: 0,
        pmAllTime: 0,
        adBucket1: 0,
        adBucket2: 0,
        adBucket3: 0,
        adBucket4: 0,
        adAllTime: 0,
        lastRollDate: null,
        updatedAt: now.toISOString()
      }
    };
    await dgraphClient.mutate(mutation);
    
    return {
      pmBucket1: 0, pmBucket2: 0, pmBucket3: 0, pmBucket4: 0, pmAllTime: 0,
      adBucket1: 0, adBucket2: 0, adBucket3: 0, adBucket4: 0, adAllTime: 0,
      lastRollDate: null,
      updatedAt: now
    };
  }

  /**
   * Roll buckets if needed (check if 30 days have passed since lastRollDate)
   * Returns true if buckets were rolled, false if not needed
   */
  async rollBucketsIfNeeded(ledger: EarningsLedger, ledgerType: 'dapp' | 'account', id: string): Promise<boolean> {
    const now = new Date();
    const lastRoll = ledger.lastRollDate || ledger.updatedAt;
    const daysSinceRoll = (now.getTime() - lastRoll.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceRoll < BUCKET_DAYS) {
      return false; // Not time to roll yet
    }

    // Calculate how many bucket rolls are needed (could be multiple if service was down)
    const rollsNeeded = Math.floor(daysSinceRoll / BUCKET_DAYS);
    
    logger.info(`Rolling buckets for ${ledgerType} ${id}`, { rollsNeeded, daysSinceRoll });

    // Roll buckets: 1→2, 2→3, 3→4, 4→allTime (then clear 4)
    // If multiple rolls needed, we do them sequentially
    let updatedLedger = { ...ledger };
    
    for (let roll = 0; roll < rollsNeeded; roll++) {
      // PM earnings roll
      updatedLedger.pmAllTime += updatedLedger.pmBucket4;
      updatedLedger.pmBucket4 = updatedLedger.pmBucket3;
      updatedLedger.pmBucket3 = updatedLedger.pmBucket2;
      updatedLedger.pmBucket2 = updatedLedger.pmBucket1;
      updatedLedger.pmBucket1 = 0;
      
      // Ad revenue roll
      updatedLedger.adAllTime += updatedLedger.adBucket4;
      updatedLedger.adBucket4 = updatedLedger.adBucket3;
      updatedLedger.adBucket3 = updatedLedger.adBucket2;
      updatedLedger.adBucket2 = updatedLedger.adBucket1;
      updatedLedger.adBucket1 = 0;
    }
    
    updatedLedger.lastRollDate = now;
    updatedLedger.updatedAt = now;

    // Save rolled ledger
    const uid = ledgerType === 'dapp' ? `_:ledger_dapp_${id}` : `_:ledger_account_${id}`;
    const mutation = {
      set: {
        uid,
        [`${ledgerType === 'dapp' ? 'dappId' : 'account'}`]: id,
        dgraph_type: ledgerType === 'dapp' ? 'DAppEarningsLedger' : 'AccountEarningsLedger',
        pmBucket1: updatedLedger.pmBucket1,
        pmBucket2: updatedLedger.pmBucket2,
        pmBucket3: updatedLedger.pmBucket3,
        pmBucket4: updatedLedger.pmBucket4,
        pmAllTime: updatedLedger.pmAllTime,
        adBucket1: updatedLedger.adBucket1,
        adBucket2: updatedLedger.adBucket2,
        adBucket3: updatedLedger.adBucket3,
        adBucket4: updatedLedger.adBucket4,
        adAllTime: updatedLedger.adAllTime,
        lastRollDate: updatedLedger.lastRollDate.toISOString(),
        updatedAt: updatedLedger.updatedAt.toISOString()
      }
    };
    await dgraphClient.mutate(mutation);

    return true;
  }

  /**
   * Add PM earnings to a dApp ledger (adds to bucket 1)
   */
  async addDAppPMEarnings(dappId: string, amount: number): Promise<void> {
    const ledger = await this.getOrCreateDAppLedger(dappId);
    await this.rollBucketsIfNeeded(ledger, 'dapp', dappId);
    
    // Re-fetch after potential roll
    const updatedLedger = await this.getOrCreateDAppLedger(dappId);
    
    const mutation = {
      set: {
        uid: `_:ledger_dapp_${dappId}`,
        dappId,
        dgraph_type: 'DAppEarningsLedger',
        pmBucket1: (updatedLedger.pmBucket1 || 0) + amount,
        pmBucket2: updatedLedger.pmBucket2 || 0,
        pmBucket3: updatedLedger.pmBucket3 || 0,
        pmBucket4: updatedLedger.pmBucket4 || 0,
        pmAllTime: updatedLedger.pmAllTime || 0,
        adBucket1: updatedLedger.adBucket1 || 0,
        adBucket2: updatedLedger.adBucket2 || 0,
        adBucket3: updatedLedger.adBucket3 || 0,
        adBucket4: updatedLedger.adBucket4 || 0,
        adAllTime: updatedLedger.adAllTime || 0,
        lastRollDate: updatedLedger.lastRollDate?.toISOString() || null,
        updatedAt: new Date().toISOString()
      }
    };
    await dgraphClient.mutate(mutation);
    logger.debug('Added PM earnings to dApp ledger', { dappId, amount });
  }

  /**
   * Add ad revenue to a dApp ledger (adds to bucket 1)
   */
  async addDAppAdRevenue(dappId: string, amount: number): Promise<void> {
    const ledger = await this.getOrCreateDAppLedger(dappId);
    await this.rollBucketsIfNeeded(ledger, 'dapp', dappId);
    
    const updatedLedger = await this.getOrCreateDAppLedger(dappId);
    
    const mutation = {
      set: {
        uid: `_:ledger_dapp_${dappId}`,
        dappId,
        dgraph_type: 'DAppEarningsLedger',
        pmBucket1: updatedLedger.pmBucket1 || 0,
        pmBucket2: updatedLedger.pmBucket2 || 0,
        pmBucket3: updatedLedger.pmBucket3 || 0,
        pmBucket4: updatedLedger.pmBucket4 || 0,
        pmAllTime: updatedLedger.pmAllTime || 0,
        adBucket1: (updatedLedger.adBucket1 || 0) + amount,
        adBucket2: updatedLedger.adBucket2 || 0,
        adBucket3: updatedLedger.adBucket3 || 0,
        adBucket4: updatedLedger.adBucket4 || 0,
        adAllTime: updatedLedger.adAllTime || 0,
        lastRollDate: updatedLedger.lastRollDate?.toISOString() || null,
        updatedAt: new Date().toISOString()
      }
    };
    await dgraphClient.mutate(mutation);
    logger.debug('Added ad revenue to dApp ledger', { dappId, amount });
  }

  /**
   * Add PM earnings to an account ledger (adds to bucket 1)
   */
  async addAccountPMEarnings(account: string, amount: number): Promise<void> {
    const ledger = await this.getOrCreateAccountLedger(account);
    await this.rollBucketsIfNeeded(ledger, 'account', account);
    
    const updatedLedger = await this.getOrCreateAccountLedger(account);
    
    const mutation = {
      set: {
        uid: `_:ledger_account_${account}`,
        account,
        dgraph_type: 'AccountEarningsLedger',
        pmBucket1: (updatedLedger.pmBucket1 || 0) + amount,
        pmBucket2: updatedLedger.pmBucket2 || 0,
        pmBucket3: updatedLedger.pmBucket3 || 0,
        pmBucket4: updatedLedger.pmBucket4 || 0,
        pmAllTime: updatedLedger.pmAllTime || 0,
        adBucket1: updatedLedger.adBucket1 || 0,
        adBucket2: updatedLedger.adBucket2 || 0,
        adBucket3: updatedLedger.adBucket3 || 0,
        adBucket4: updatedLedger.adBucket4 || 0,
        adAllTime: updatedLedger.adAllTime || 0,
        lastRollDate: updatedLedger.lastRollDate?.toISOString() || null,
        updatedAt: new Date().toISOString()
      }
    };
    await dgraphClient.mutate(mutation);
    logger.debug('Added PM earnings to account ledger', { account, amount });
    
    // Update voter roll incrementally
    await this.updateVoterRollForAccount(account, 'pm').catch(err => 
      logger.debug('Voter roll update skipped (non-fatal)', { account, error: err })
    );
  }

  /**
   * Add ad revenue to an account ledger (adds to bucket 1)
   */
  async addAccountAdRevenue(account: string, amount: number): Promise<void> {
    const ledger = await this.getOrCreateAccountLedger(account);
    await this.rollBucketsIfNeeded(ledger, 'account', account);
    
    const updatedLedger = await this.getOrCreateAccountLedger(account);
    
    const mutation = {
      set: {
        uid: `_:ledger_account_${account}`,
        account,
        dgraph_type: 'AccountEarningsLedger',
        pmBucket1: updatedLedger.pmBucket1 || 0,
        pmBucket2: updatedLedger.pmBucket2 || 0,
        pmBucket3: updatedLedger.pmBucket3 || 0,
        pmBucket4: updatedLedger.pmBucket4 || 0,
        pmAllTime: updatedLedger.pmAllTime || 0,
        adBucket1: (updatedLedger.adBucket1 || 0) + amount,
        adBucket2: updatedLedger.adBucket2 || 0,
        adBucket3: updatedLedger.adBucket3 || 0,
        adBucket4: updatedLedger.adBucket4 || 0,
        adAllTime: updatedLedger.adAllTime || 0,
        lastRollDate: updatedLedger.lastRollDate?.toISOString() || null,
        updatedAt: new Date().toISOString()
      }
    };
    await dgraphClient.mutate(mutation);
    logger.debug('Added ad revenue to account ledger', { account, amount });
    
    // Update voter roll incrementally
    await this.updateVoterRollForAccount(account, 'ad').catch(err => 
      logger.debug('Voter roll update skipped (non-fatal)', { account, error: err })
    );
  }

  /**
   * Get rolling window totals (buckets 2+3+4 = 90 days)
   */
  getRollingWindowTotals(ledger: EarningsLedger): { pmTotal: number; adTotal: number } {
    return {
      pmTotal: (ledger.pmBucket2 || 0) + (ledger.pmBucket3 || 0) + (ledger.pmBucket4 || 0),
      adTotal: (ledger.adBucket2 || 0) + (ledger.adBucket3 || 0) + (ledger.adBucket4 || 0)
    };
  }

  /**
   * Get all-time totals (all buckets + allTime)
   */
  getAllTimeTotals(ledger: EarningsLedger): { pmTotal: number; adTotal: number } {
    return {
      pmTotal: (ledger.pmBucket1 || 0) + (ledger.pmBucket2 || 0) + (ledger.pmBucket3 || 0) + 
               (ledger.pmBucket4 || 0) + (ledger.pmAllTime || 0),
      adTotal: (ledger.adBucket1 || 0) + (ledger.adBucket2 || 0) + (ledger.adBucket3 || 0) + 
               (ledger.adBucket4 || 0) + (ledger.adAllTime || 0)
    };
  }

  /**
   * Update voter roll incrementally when account earnings change.
   * This is called after earnings are updated to maintain the voter roll in real-time.
   * 
   * Strategy:
   * 1. Get account's rolling totals
   * 2. Get cached threshold from voter roll (or calculate if missing)
   * 3. Add/remove account if it crosses threshold
   * 4. For PM earners, maintain equal number to creators, deduped
   * 
   * Threshold is cached in GovernanceVoterRoll and only recalculated when:
   * - Missing (first time)
   * - Account drops below threshold (may have changed)
   */
  async updateVoterRollForAccount(account: string, earningsType: 'ad' | 'pm'): Promise<void> {
    try {
      // Get account's current rolling totals
      const ledger = await this.getOrCreateAccountLedger(account);
      await this.rollBucketsIfNeeded(ledger, 'account', account);
      const updatedLedger = await this.getOrCreateAccountLedger(account);
      const rolling = this.getRollingWindowTotals(updatedLedger);

      // Get or create current voter roll with cached threshold
      const voterRoll = await this.getOrCreateVoterRollWithThreshold();
      const wasCreatorEligible = voterRoll.eligibleVoters.includes(account);
      
      // Check if account should be eligible as creator (top 50% by ad earnings)
      const isCreatorEligible = rolling.adTotal > 0 && 
                                (voterRoll.threshold === null || rolling.adTotal >= voterRoll.threshold);

      // Update creator eligibility
      if (isCreatorEligible && !wasCreatorEligible) {
        // Add to voter roll
        await this.addToVoterRoll(account, 'creator', voterRoll);
        // Refresh roll to get updated creator count for PM earner update
        const refreshedRoll = await this.getOrCreateVoterRollWithThreshold();
        if (earningsType === 'pm') {
          await this.updatePMEarnerRoll(refreshedRoll);
        }
      } else if (!isCreatorEligible && wasCreatorEligible) {
        // Account dropped below threshold - recalculate threshold (it may have changed)
        const newThreshold = await this.calculateCreatorThreshold();
        await this.updateVoterRollThreshold(voterRoll.id, newThreshold.minAdEarnings);
        
        // Re-check eligibility with new threshold
        const stillEligible = rolling.adTotal >= newThreshold.minAdEarnings;
        if (!stillEligible) {
          // Remove from voter roll (but keep if eligible as PM earner)
          const refreshedRoll = await this.getOrCreateVoterRollWithThreshold();
          const pmEligible = await this.isPMEarnerEligible(account, refreshedRoll);
          if (!pmEligible) {
            await this.removeFromVoterRoll(account, refreshedRoll);
          }
        }
      } else if (earningsType === 'pm') {
        // For PM earners, maintain equal number to creators, deduped
        await this.updatePMEarnerRoll(voterRoll);
      }

      logger.debug('Updated voter roll for account', { account, earningsType, isCreatorEligible });
    } catch (error) {
      logger.warn('Failed to update voter roll incrementally (non-fatal)', { account, error });
      // Non-fatal - voter roll can be recalculated later if needed
    }
  }

  /**
   * Get or create the current active voter roll with cached threshold
   */
  private async getOrCreateVoterRollWithThreshold(): Promise<{
    id: string;
    eligibleVoters: string[];
    creatorVoters: string[];
    pmVoters: string[];
    creatorCount: number;
    pmEarnerCount: number;
    threshold: number | null;
  }> {
    const query = `
      query activeVoterRoll {
        roll(func: type(GovernanceVoterRoll), orderdesc: computedAt, first: 1) {
          id
          eligibleVoters
          creatorCount
          pmEarnerCount
          threshold
          thresholdUpdatedAt
          computedAt
        }
      }
    `;
    const result = await dgraphClient.query(query);
    const existing = result.roll?.[0];

    if (existing) {
      // Parse the voter lists (stored as arrays in DGraph)
      const eligibleVoters = Array.isArray(existing.eligibleVoters) 
        ? existing.eligibleVoters 
        : existing.eligibleVoters 
          ? [existing.eligibleVoters] 
          : [];
      
      // If threshold is missing or stale (older than 24 hours), recalculate
      const thresholdAge = existing.thresholdUpdatedAt 
        ? (Date.now() - new Date(existing.thresholdUpdatedAt).getTime()) / (1000 * 60 * 60)
        : Infinity;
      
      let threshold = existing.threshold !== undefined ? existing.threshold : null;
      if (threshold === null || thresholdAge > 24) {
        // Recalculate threshold
        const thresholdData = await this.calculateCreatorThreshold();
        threshold = thresholdData.minAdEarnings;
        await this.updateVoterRollThreshold(existing.id, threshold);
      }
      
      return {
        id: existing.id,
        eligibleVoters,
        creatorVoters: eligibleVoters, // Simplified - would need separate field
        pmVoters: [],
        creatorCount: existing.creatorCount || 0,
        pmEarnerCount: existing.pmEarnerCount || 0,
        threshold
      };
    }

    // Create new voter roll with initial threshold
    const thresholdData = await this.calculateCreatorThreshold();
    const rollId = `voter_roll_${Date.now()}`;
    const now = new Date();
    const mutation = {
      set: {
        uid: `_:roll_${rollId}`,
        dgraph_type: 'GovernanceVoterRoll',
        id: rollId,
        eligibleVoters: [],
        creatorCount: 0,
        pmEarnerCount: 0,
        threshold: thresholdData.minAdEarnings,
        thresholdUpdatedAt: now.toISOString(),
        periodStart: now.toISOString(),
        periodEnd: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        computedAt: now.toISOString()
      }
    };
    await dgraphClient.mutate(mutation);

    return {
      id: rollId,
      eligibleVoters: [],
      creatorVoters: [],
      pmVoters: [],
      creatorCount: 0,
      pmEarnerCount: 0,
      threshold: thresholdData.minAdEarnings
    };
  }

  /**
   * Update the cached threshold in voter roll
   */
  private async updateVoterRollThreshold(rollId: string, threshold: number): Promise<void> {
    const mutation = {
      set: {
        uid: `_:roll_${rollId}`,
        id: rollId,
        dgraph_type: 'GovernanceVoterRoll',
        threshold,
        thresholdUpdatedAt: new Date().toISOString()
      }
    };
    await dgraphClient.mutate(mutation);
  }

  /**
   * Calculate the 50th percentile threshold for creator eligibility.
   * Returns the minimum ad earnings needed to be in top 50% of creators.
   */
  private async calculateCreatorThreshold(): Promise<{ minAdEarnings: number; totalCreators: number }> {
    // Query all accounts with positive rolling ad earnings, ordered DESC
    const query = `
      query creatorThreshold {
        accounts(func: type(AccountEarningsLedger)) @filter(
          gt(math(adBucket2 + adBucket3 + adBucket4), 0)
        ) {
          account
          adBucket2 adBucket3 adBucket4
        }
      }
    `;
    const result = await dgraphClient.query(query);
    const accounts = result.accounts || [];

    // Calculate rolling totals and sort
    const totals = accounts.map((acc: any) => ({
      account: acc.account,
      rollingAd: (acc.adBucket2 || 0) + (acc.adBucket3 || 0) + (acc.adBucket4 || 0)
    })).filter((a: any) => a.rollingAd > 0)
      .sort((a: any, b: any) => b.rollingAd - a.rollingAd);

    if (totals.length === 0) {
      return { minAdEarnings: 0, totalCreators: 0 };
    }

    // 50th percentile = middle value (or value at index floor(length/2))
    const medianIndex = Math.floor(totals.length / 2);
    const minAdEarnings = totals[medianIndex].rollingAd;

    return { minAdEarnings, totalCreators: totals.length };
  }

  /**
   * Check if account is eligible as PM earner (top N PM earners, where N = creator count)
   */
  private async isPMEarnerEligible(account: string, voterRoll: any): Promise<boolean> {
    // Get account's PM earnings
    const ledger = await this.getOrCreateAccountLedger(account);
    const rolling = this.getRollingWindowTotals(ledger);
    
    if (rolling.pmTotal <= 0) return false;

    // Query top PM earners (limit = creator count)
    const creatorCount = voterRoll.creatorCount || 0;
    if (creatorCount === 0) return false;

    const query = `
      query topPMEarners($limit: int) {
        accounts(func: type(AccountEarningsLedger), orderdesc: math(pmBucket2 + pmBucket3 + pmBucket4), first: $limit) @filter(
          gt(math(pmBucket2 + pmBucket3 + pmBucket4), 0)
        ) {
          account
          pmBucket2 pmBucket3 pmBucket4
        }
      }
    `;
    const result = await dgraphClient.query(query, { $limit: creatorCount });
    const topPMEarners = (result.accounts || []).map((acc: any) => acc.account);

    return topPMEarners.includes(account);
  }

  /**
   * Add account to voter roll
   */
  private async addToVoterRoll(account: string, type: 'creator' | 'pm', voterRoll: any): Promise<void> {
    if (voterRoll.eligibleVoters.includes(account)) {
      return; // Already in roll
    }

    const updatedVoters = [...voterRoll.eligibleVoters, account];
    const updatedCreatorCount = type === 'creator' 
      ? (voterRoll.creatorCount || 0) + 1 
      : voterRoll.creatorCount || 0;
    const updatedPMCount = type === 'pm'
      ? (voterRoll.pmEarnerCount || 0) + 1
      : voterRoll.pmEarnerCount || 0;

    const mutation = {
      set: {
        uid: `_:roll_${voterRoll.id}`,
        id: voterRoll.id,
        dgraph_type: 'GovernanceVoterRoll',
        eligibleVoters: updatedVoters,
        creatorCount: updatedCreatorCount,
        pmEarnerCount: updatedPMCount,
        computedAt: new Date().toISOString()
      }
    };
    await dgraphClient.mutate(mutation);
  }

  /**
   * Remove account from voter roll
   */
  private async removeFromVoterRoll(account: string, voterRoll: any): Promise<void> {
    if (!voterRoll.eligibleVoters.includes(account)) {
      return; // Not in roll
    }

    const updatedVoters = voterRoll.eligibleVoters.filter((a: string) => a !== account);
    
    const mutation = {
      set: {
        uid: `_:roll_${voterRoll.id}`,
        id: voterRoll.id,
        dgraph_type: 'GovernanceVoterRoll',
        eligibleVoters: updatedVoters,
        computedAt: new Date().toISOString()
      }
    };
    await dgraphClient.mutate(mutation);
  }

  /**
   * Update PM earner roll to maintain equal count to creators, deduped.
   * This is called incrementally when PM earnings update.
   */
  private async updatePMEarnerRoll(voterRoll: any): Promise<void> {
    // Refresh voter roll to get latest creator count
    const refreshedRoll = await this.getOrCreateVoterRollWithThreshold();
    const creatorCount = refreshedRoll.creatorCount || 0;
    if (creatorCount === 0) return;

    // Query top PM earners (excluding those already in roll as creators)
    const query = `
      query topPMEarners($limit: int) {
        accounts(func: type(AccountEarningsLedger), orderdesc: math(pmBucket2 + pmBucket3 + pmBucket4), first: $limit) @filter(
          gt(math(pmBucket2 + pmBucket3 + pmBucket4), 0)
        ) {
          account
          pmBucket2 pmBucket3 pmBucket4
        }
      }
    `;
    const result = await dgraphClient.query(query, { $limit: creatorCount * 2 }); // Get extra to account for deduping
    const allPMEarners = (result.accounts || []).map((acc: any) => acc.account);
    
    // Dedupe against creator voters (they're all in eligibleVoters, but we want to identify which are creators)
    const currentVoters = refreshedRoll.eligibleVoters || [];
    const pmEarnersDeduped = allPMEarners
      .filter((acc: string) => !currentVoters.includes(acc)) // Don't add if already eligible as creator
      .slice(0, creatorCount);

    // Update voter roll with PM earners (add to existing voters)
    const updatedVoters = [...new Set([...currentVoters, ...pmEarnersDeduped])];
    
    const mutation = {
      set: {
        uid: `_:roll_${refreshedRoll.id}`,
        id: refreshedRoll.id,
        dgraph_type: 'GovernanceVoterRoll',
        eligibleVoters: updatedVoters,
        pmEarnerCount: pmEarnersDeduped.length,
        computedAt: new Date().toISOString()
      }
    };
    await dgraphClient.mutate(mutation);
  }

  /**
   * Get current voter roll (public method for API)
   */
  async getCurrentVoterRoll(): Promise<{
    id: string;
    eligibleVoters: string[];
    creatorCount: number;
    pmEarnerCount: number;
    threshold: number | null;
    periodStart: Date;
    periodEnd: Date;
    computedAt: Date;
  }> {
    const voterRoll = await this.getOrCreateVoterRollWithThreshold();
    const query = `
      query voterRoll($id: string) {
        roll(func: eq(id, $id)) @filter(type(GovernanceVoterRoll)) {
          id
          eligibleVoters
          creatorCount
          pmEarnerCount
          threshold
          periodStart
          periodEnd
          computedAt
        }
      }
    `;
    const result = await dgraphClient.query(query, { $id: voterRoll.id });
    const roll = result.roll?.[0];
    
    if (!roll) {
      // Return the in-memory version
      return {
        id: voterRoll.id,
        eligibleVoters: voterRoll.eligibleVoters,
        creatorCount: voterRoll.creatorCount,
        pmEarnerCount: voterRoll.pmEarnerCount,
        threshold: voterRoll.threshold,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        computedAt: new Date()
      };
    }

    return {
      id: roll.id,
      eligibleVoters: Array.isArray(roll.eligibleVoters) ? roll.eligibleVoters : roll.eligibleVoters ? [roll.eligibleVoters] : [],
      creatorCount: roll.creatorCount || 0,
      pmEarnerCount: roll.pmEarnerCount || 0,
      threshold: roll.threshold !== undefined ? roll.threshold : null,
      periodStart: new Date(roll.periodStart),
      periodEnd: new Date(roll.periodEnd),
      computedAt: new Date(roll.computedAt)
    };
  }
}

export const earningsService = new EarningsService();
