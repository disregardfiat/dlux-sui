import axios from 'axios';
import { logger } from '../utils/logger';
import { suiClient } from '../sui/client';
import {
  BillingOverview,
  SubscriptionStatus,
  SuiNSTerm,
  PayoutBalances,
  StorageFundingStatus,
  ClaimPayoutRequest,
  ClaimPayoutResponse,
  PayoutBucket
} from '@dlux-sui/types';

const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';

const SUI_COIN_TYPE = '0x2::sui::SUI';
const MIST_PER_SUI = 1_000_000_000;

/** Extract address from RPC ObjectOwner (AddressOwner or ObjectOwner). */
function ownerAddress(owner: { AddressOwner?: string; ObjectOwner?: string } | string | null): string | null {
  if (!owner || typeof owner === 'string') return owner || null;
  if ('AddressOwner' in owner) return owner.AddressOwner ?? null;
  if ('ObjectOwner' in owner) return owner.ObjectOwner ?? null;
  return null;
}

export class BillingService {
  /**
   * Get comprehensive billing overview for an owner.
   * Pass authHeader (e.g. "Bearer <jwt>") so DGraph returns full subscription details when owner is the JWT identity.
   */
  async getBillingOverview(owner: string, authHeader?: string): Promise<BillingOverview> {
    try {
      const subscription = await this.getSubscriptionStatus(owner, authHeader);

      // Get SuiNS term status
      const suins = await this.getSuiNSTerm(owner);

      // Get payout balances
      const payouts = await this.getPayoutBalances(owner);

      // Get storage funding status for all dApps
      const storageFunding = await this.getStorageFundingStatus(owner);

      return {
        owner,
        subscription,
        suins,
        payouts,
        storageFunding
      };
    } catch (error) {
      logger.error('Error getting billing overview', { owner, error });
      throw error;
    }
  }

  /**
   * Get subscription status - checks DGraph subscription API.
   * When authHeader is provided and owner matches JWT identity, DGraph returns full details; otherwise active only.
   */
  private async getSubscriptionStatus(owner: string, authHeader?: string): Promise<SubscriptionStatus> {
    try {
      const headers: Record<string, string> = {};
      if (authHeader) headers.Authorization = authHeader;
      const res = await axios.get(`${DGRAPH_SERVICE_URL}/subscription/status`, {
        params: { subscriber: owner },
        headers,
        timeout: 5000
      });
      const data = res.data;
      const active = !!data?.active;
      const latest = data?.subscriptions?.[0];
      return {
        active,
        level: active ? 'premium' : 'basic',
        expiresAt: latest?.expiresAt ? new Date(latest.expiresAt) : new Date(0),
        autoRenew: false, // TODO: support auto-renew
        suiBalance: 0 // TODO: fetch from chain
      };
    } catch (error) {
      logger.warn('Failed to get subscription status, using inactive', { owner, error: error instanceof Error ? error.message : String(error) });
      return {
        active: false,
        level: 'basic',
        expiresAt: new Date(0),
        autoRenew: false,
        suiBalance: 0
      };
    }
  }

  /**
   * Get SuiNS term status
   */
  private async getSuiNSTerm(owner: string): Promise<SuiNSTerm> {
    try {
      // Query SuiNS service for domain and expiration
      const suinsResponse = await axios.get(`${process.env.SUI_SERVICE_URL || 'http://localhost:3001'}/suins/profile/${owner}`);

      if (suinsResponse.data && suinsResponse.data.suinsName) {
        const domain = suinsResponse.data.suinsName;
        // Mock expiration - in production, this would come from SuiNS contract
        const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 6 months
        const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        return {
          active: true,
          domain,
          expiresAt,
          daysRemaining,
          suiBalance: 5.0 // Mock renewal cost
        };
      }

      return {
        active: false,
        suiBalance: 0
      };
    } catch (error) {
      logger.warn('Failed to get SuiNS term', { owner, error });
      return {
        active: false,
        suiBalance: 0
      };
    }
  }

  /**
   * Get payout balances for an owner
   */
  private async getPayoutBalances(owner: string): Promise<PayoutBalances> {
    try {
      // Get ad share from DGraph service
      let adShare = 0;
      try {
        const adResponse = await axios.get(`${DGRAPH_SERVICE_URL}/ads/revenue/owner/${owner}`);
        adShare = adResponse.data.total || 0;
      } catch (error) {
        logger.warn('Failed to get ad share', { owner, error: error instanceof Error ? error.message : String(error) });
      }

      // Subscription revenue: programmatic costs (gas, Walrus, contract/server fees) first, then 90% → ad-share account, 10% → foundation.
      // The ad-share account is a single pool; when creators draw down ad-share credits they get both ad and subscriber share.
      // Providers get signed statements (Brave-like): ad statement and subscriber statement. See docs/subscription-foundation-model.md.
      const subscriptionShare = 0; // Subscription share flows into the same ad-share pool; creator draw-down is from that combined pool

      // Get PM share from PM service
      let pmShare = 0;
      try {
        const pmResponse = await axios.get(`${DGRAPH_SERVICE_URL}/markets/payouts/${owner}`);
        pmShare = pmResponse.data.total || 0;
      } catch (error) {
        logger.warn('Failed to get PM share', { owner, error: error instanceof Error ? error.message : String(error) });
      }

      // Get premium content earnings
      let premiumShare = 0;
      try {
        const premiumResponse = await axios.get(`${process.env.WALRUS_SERVICE_URL || 'http://localhost:3002'}/premium/earnings/${owner}`);
        premiumShare = premiumResponse.data.total || 0;
      } catch (error) {
        logger.warn('Failed to get premium content earnings', { owner, error: error instanceof Error ? error.message : String(error) });
      }

      const total = adShare + subscriptionShare + pmShare + premiumShare;

      return {
        adShare,
        subscriptionShare,
        pmShare,
        premiumShare,
        total
      };
    } catch (error) {
      logger.error('Error getting payout balances', { owner, error });
      throw error;
    }
  }

  /**
   * Get storage funding status for all dApps owned by the user
   */
  private async getStorageFundingStatus(owner: string): Promise<StorageFundingStatus[]> {
    try {
      // Get all dApps owned by this user
      const dappsResponse = await axios.get(`${process.env.SUI_SERVICE_URL || 'http://localhost:3001'}/dapps/owner/${owner}`);
      const dapps = dappsResponse.data.dapps || [];

      const fundingStatuses: StorageFundingStatus[] = [];

      for (const dapp of dapps) {
        if (!dapp.blobIds || dapp.blobIds.length === 0) continue;

        // Get funding status for each blob
        for (const blobId of dapp.blobIds) {
          try {
            const blobStatus = await this.getBlobFundingStatus(dapp, blobId);
            fundingStatuses.push(blobStatus);
          } catch (error) {
            logger.warn('Failed to get blob funding status', { dappId: dapp.id, blobId, error });
          }
        }
      }

      return fundingStatuses;
    } catch (error) {
      logger.error('Error getting storage funding status', { owner, error });
      throw error;
    }
  }

  /**
   * Get funding status for a specific blob
   */
  private async getBlobFundingStatus(dapp: any, blobId: string): Promise<StorageFundingStatus> {
    // Get blob billing info from Walrus service
    const walrusResponse = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${blobId}/billing`);
    const blobBilling = walrusResponse.data;

    // Get contributions
    let adContribution = 0;
    let pmContribution = 0;

    try {
      const adResponse = await axios.get(`${DGRAPH_SERVICE_URL}/ads/revenue/${dapp.id}`);
      adContribution = adResponse.data.total || 0;
    } catch (error) {
      logger.warn('Failed to get ad revenue for dApp', { dappId: dapp.id, error: error instanceof Error ? error.message : String(error) });
    }

    try {
      const pmResponse = await axios.get(`${DGRAPH_SERVICE_URL}/markets/fees/${dapp.id}`);
      pmContribution = pmResponse.data.total || 0;
    } catch (error) {
      logger.warn('Failed to get PM fees for dApp', { dappId: dapp.id, error: error instanceof Error ? error.message : String(error) });
    }

    // Calculate metrics
    const termProgressPercent = blobBilling.termProgressPercent;
    const totalFunded = pmContribution + adContribution;
    const coveragePercent = (totalFunded / blobBilling.storageCost) * 100;

    // Ads only contribute after 50% term progress
    const adsContributeToStorage = termProgressPercent >= 50;
    const effectiveAdContribution = adsContributeToStorage ? adContribution : 0;

    // Precarious if >75% through term but <100% funded
    const precarious = termProgressPercent > 75 && coveragePercent < 100;

    // Auto-renew if fully funded
    const autoRenewEligible = coveragePercent >= 100;

    return {
      dappId: dapp.id,
      dappName: dapp.name,
      blobId,
      termStart: new Date(blobBilling.termStart),
      termEnd: new Date(blobBilling.termEnd),
      termLengthDays: blobBilling.termLengthDays,
      storageCost: blobBilling.storageCost,
      funded: totalFunded,
      coveragePercent: Math.min(coveragePercent, 100),
      termProgressPercent,
      precarious,
      autoRenewEligible,
      pmContribution,
      adContribution: effectiveAdContribution,
      fundingSource: pmContribution > 0 && adContribution > 0 ? 'mixed' :
                   pmContribution > 0 ? 'pm' :
                   adContribution > 0 ? 'ads' : 'manual'
    };
  }

  /**
   * Claim payouts to a recipient address
   */
  async claimPayouts(owner: string, buckets: PayoutBucket[], recipientAddress: string): Promise<ClaimPayoutResponse> {
    try {
      // Validate recipient address (basic check)
      if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 66) {
        throw new Error('Invalid recipient address format');
      }

      // Calculate total amount to claim
      const totalAmount = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);

      // TODO: In production, this would create a SUI transaction to transfer funds
      // For MVP, we'll simulate the transaction
      const transactionId = `claim_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Update payout balances (deduct claimed amounts)
      // In production, this would be handled by the blockchain transaction
      await this.updatePayoutBalances(owner, buckets);

      logger.info('Payouts claimed', { owner, recipientAddress, totalAmount, transactionId });

      const claimed: Record<string, number> = {};
      for (const bucket of buckets) {
        claimed[bucket.type] = bucket.amount;
      }

      return {
        transactionId,
        claimed,
        total: totalAmount
      };
    } catch (error) {
      logger.error('Error claiming payouts', { owner, buckets, recipientAddress, error });
      throw error;
    }
  }

  /**
   * Update payout balances after claiming
   */
  private async updatePayoutBalances(owner: string, buckets: PayoutBucket[]): Promise<void> {
    // TODO: In production, this would be handled by blockchain state updates
    // For MVP, we could store claimed amounts in DGraph or just log them
    for (const bucket of buckets) {
      logger.info('Claimed payout bucket', {
        owner,
        type: bucket.type,
        amount: bucket.amount
      });
    }
  }

  /**
   * Verify payment transaction for premium content purchases (with platform fee handling).
   * Verifies on-chain that the tx is a SUI transfer from buyer to expectedRecipient for expectedAmount.
   */
  async verifyPremiumPayment(
    txId: string,
    expectedAmount: number,
    expectedRecipient: string,
    buyer: string,
    platformFee: number,
    foundationAddress: string,
    creatorShare: number
  ): Promise<boolean> {
    try {
      if (!txId.startsWith('0x') || txId.length < 64) {
        logger.warn('Invalid transaction ID format', { txId });
        return false;
      }
      if (expectedAmount <= 0) return false;
      if (!expectedRecipient.startsWith('0x') || expectedRecipient.length !== 66) return false;
      if (!buyer.startsWith('0x') || buyer.length !== 66) return false;
      if (platformFee < 0 || creatorShare < 0) return false;
      if (Math.abs((creatorShare + platformFee) - expectedAmount) > 0.01) return false;

      return this.verifyPaymentOnChain(txId, expectedAmount, expectedRecipient, buyer);
    } catch (error) {
      logger.error('Error verifying premium payment', { txId, error });
      return false;
    }
  }

  /**
   * Verify payment transaction for regular purchases.
   * Verifies on-chain that the tx is a SUI transfer from buyer to expectedRecipient for expectedAmount.
   */
  async verifyPayment(txId: string, expectedAmount: number, expectedRecipient: string, buyer: string): Promise<boolean> {
    try {
      if (!txId.startsWith('0x') || txId.length < 64) {
        logger.warn('Invalid transaction ID format', { txId });
        return false;
      }
      if (expectedAmount <= 0) return false;
      if (!expectedRecipient.startsWith('0x') || expectedRecipient.length !== 66) return false;
      if (!buyer.startsWith('0x') || buyer.length !== 66) return false;

      return this.verifyPaymentOnChain(txId, expectedAmount, expectedRecipient, buyer);
    } catch (error) {
      logger.error('Error verifying payment', { txId, error });
      return false;
    }
  }

  /**
   * On-chain verification: fetch tx by digest and check SUI balance changes match expected transfer.
   */
  private async verifyPaymentOnChain(
    txId: string,
    expectedAmount: number,
    expectedRecipient: string,
    buyer: string
  ): Promise<boolean> {
    const client = suiClient.getClient();
    const tx = await client.getTransactionBlock({
      digest: txId,
      options: { showBalanceChanges: true }
    });
    if (tx.errors && tx.errors.length > 0) {
      logger.warn('Transaction has errors', { txId, errors: tx.errors });
      return false;
    }
    const changes = tx.balanceChanges ?? [];
    const expectedMist = BigInt(Math.round(expectedAmount * MIST_PER_SUI));
    const tolerance = BigInt(1); // allow 1 MIST rounding

    let buyerDebit = BigInt(0);
    let recipientCredit = BigInt(0);
    const norm = (a: string) => (a || '').toLowerCase();

    for (const c of changes) {
      if (c.coinType !== SUI_COIN_TYPE) continue;
      const addr = ownerAddress(c.owner as { AddressOwner?: string; ObjectOwner?: string });
      if (!addr) continue;
      const amount = BigInt(c.amount);
      if (norm(addr) === norm(buyer) && amount < 0) buyerDebit += -amount;
      if (norm(addr) === norm(expectedRecipient) && amount > 0) recipientCredit += amount;
    }

    const ok =
      buyerDebit >= expectedMist - tolerance &&
      buyerDebit <= expectedMist + tolerance &&
      recipientCredit >= expectedMist - tolerance &&
      recipientCredit <= expectedMist + tolerance;
    if (!ok) {
      logger.warn('Balance changes do not match expected payment', {
        txId,
        expectedMist: expectedMist.toString(),
        buyerDebit: buyerDebit.toString(),
        recipientCredit: recipientCredit.toString()
      });
    }
    return ok;
  }

  /**
   * List recent transaction digests for an address (sender). For UI "Recent transactions" / explorer links.
   */
  async getTransactionsForAddress(owner: string, limit: number = 20): Promise<{ digest: string; timestampMs: string | null }[]> {
    try {
      const client = suiClient.getClient();
      const page = await client.queryTransactionBlocks({
        filter: { FromAddress: owner },
        limit: Math.min(limit, 50),
        order: 'descending',
        options: {}
      });
      const list = (page.data ?? []).map((tx) => ({
        digest: tx.digest,
        timestampMs: tx.timestampMs ?? null
      }));
      return list;
    } catch (error) {
      logger.error('Error fetching transactions for address', { owner, error });
      return [];
    }
  }
}

export const billingService = new BillingService();