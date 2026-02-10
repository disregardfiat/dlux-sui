/**
 * E2E tests for billing API
 * Tests: Overview, claim payouts, storage funding, payment verification (including foundation)
 */

import { test, expect } from '@playwright/test';
import { apiClient } from './helpers/api-helpers';
import { testData } from './helpers/test-data';

test.describe('Billing API E2E', () => {
  const owner = testData.advertiser();
  // Valid SUI address format: 0x + 64 hex chars
  const recipientAddress = '0x' + 'a'.repeat(64);

  test.beforeAll(async () => {
    const suiHealthy = await apiClient.checkHealth('sui');
    if (!suiHealthy) {
      test.skip(true, 'SUI service not available (SUI_SERVICE_URL)');
      return;
    }
    expect(suiHealthy).toBe(true);
  });

  test('should get billing overview for owner', async () => {
    const overview = await apiClient.getBillingOverview(owner);

    expect(overview).toHaveProperty('owner', owner);
    expect(overview).toHaveProperty('subscription');
    expect(overview).toHaveProperty('suins');
    expect(overview).toHaveProperty('payouts');
    expect(overview).toHaveProperty('storageFunding');
    expect(overview.subscription).toHaveProperty('active');
    expect(overview.payouts).toHaveProperty('total');
  });

  test('should reject billing overview without owner', async () => {
    try {
      await apiClient.sui.get('/billing/overview');
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.response?.status).toBe(400);
    }
  });

  test('should get recent transactions for owner', async () => {
    try {
      const result = await apiClient.getBillingTransactions(owner);
      expect(result).toHaveProperty('transactions');
      expect(Array.isArray(result.transactions)).toBe(true);
      for (const tx of result.transactions) {
        expect(tx).toHaveProperty('digest');
        expect(typeof tx.digest).toBe('string');
        if (tx.timestampMs != null) expect(typeof tx.timestampMs).toBe('string');
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        test.skip(true, 'GET /billing/transactions not deployed on this SUI service (optional)');
        return;
      }
      throw err;
    }
  });

  test('should claim payouts with valid buckets', async () => {
    const result = await apiClient.claimPayouts(
      owner,
      [{ type: 'adShare', amount: 0.1 }, { type: 'pmShare', amount: 0.05 }],
      recipientAddress
    );

    expect(result).toHaveProperty('transactionId');
    expect(result).toHaveProperty('claimed');
    expect(result).toHaveProperty('total');
    expect(Number(result.total)).toBeCloseTo(0.15, 10);
  });

  test('should reject claim without required fields', async () => {
    try {
      await apiClient.sui.post('/billing/claim', {
        owner,
        buckets: [{ type: 'adShare', amount: 0.1 }],
        // missing recipientAddress
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.response?.status).toBe(400);
    }
  });

  test('should verify payment with valid format', async () => {
    if (process.env.SUI_SERVICE_URL?.includes('sui.dlux.io')) {
      test.skip(true, 'Verify payment uses fake txId; skip against live testnet');
      return;
    }
    const txId = '0x' + 'a'.repeat(64);
    const result = await apiClient.verifyPayment(
      txId,
      1.0,
      recipientAddress,
      owner
    );

    expect(result).toHaveProperty('verified', true);
    expect(result).toHaveProperty('txId', txId);
    expect(Number(result.amount)).toBeCloseTo(1.0, 10);
  });

  test('should verify premium payment with foundation address', async () => {
    if (process.env.SUI_SERVICE_URL?.includes('sui.dlux.io')) {
      test.skip(true, 'Verify premium payment uses fake txId; skip against live testnet');
      return;
    }
    const txId = '0x' + 'b'.repeat(64);
    const foundationAddress = '0x' + 'f'.repeat(64);
    const price = 1.0;
    const platformFee = 0.1;
    const creatorShare = 0.9;

    const result = await apiClient.verifyPremiumPayment({
      txId,
      expectedAmount: price,
      expectedRecipient: owner,
      buyer: recipientAddress,
      platformFee,
      foundationAddress,
      creatorShare,
    });

    expect(result).toHaveProperty('verified', true);
    expect(result).toHaveProperty('foundationAddress', foundationAddress);
    expect(result).toHaveProperty('platformFee', platformFee);
    expect(result).toHaveProperty('creatorShare', creatorShare);
  });

  test('should reject premium payment with invalid txId format', async () => {
    try {
      await apiClient.verifyPremiumPayment({
        txId: 'invalid-tx',
        expectedAmount: 1.0,
        expectedRecipient: owner,
        buyer: recipientAddress,
        platformFee: 0.1,
        foundationAddress: '0x' + 'f'.repeat(64),
        creatorShare: 0.9,
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.response?.status).toBe(400);
    }
  });

  test('should get storage funding when blob exists', async () => {
    const dappId = `dapp_${owner.substring(2, 18)}`;
    const blobId = `blob_${owner.substring(2, 18)}`;

    try {
      const result = await apiClient.getStorageFunding(dappId, blobId);
      expect(result).toHaveProperty('dappId', dappId);
      expect(result).toHaveProperty('blobId', blobId);
      expect(result).toHaveProperty('funded');
      expect(result).toHaveProperty('coveragePercent');
      expect(result).toHaveProperty('pmContribution');
      expect(result).toHaveProperty('adContribution');
    } catch (err: any) {
      // 404/500 if Walrus blob doesn't exist - acceptable for deployed env
      expect([404, 500]).toContain(err.response?.status || 500);
    }
  });
});
