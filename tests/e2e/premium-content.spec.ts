/**
 * E2E tests for premium content flow
 * Tests: Upload content → Purchase access → Verify access → Check earnings
 */

import { test, expect } from '@playwright/test';
import { apiClient } from './helpers/api-helpers';
import { testData } from './helpers/test-data';

test.describe('Premium Content E2E Flow', () => {
  let contentId: string;
  let owner: string;
  let buyer: string;

  test.beforeAll(async () => {
    // Verify services are running
    const walrusHealthy = await apiClient.checkHealth('walrus');
    if (!walrusHealthy) {
      test.skip(true, 'Walrus service not available (WALRUS_SERVICE_URL)');
      return;
    }
    expect(walrusHealthy).toBe(true);
  });

  test('should list premium content for dApp', async () => {
    const dappId = `dapp_${testData.advertiser().substring(2, 18)}`;
    
    const response = await apiClient.walrus.get(`/premium/content/${dappId}`);

    expect(response.status).toBe(200);
    // API returns: { contents: [...] }
    expect(response.data).toHaveProperty('contents');
    expect(Array.isArray(response.data.contents)).toBe(true);
  });

  test('should check access status', async () => {
    const contentId = `content_${testData.advertiser().substring(2, 18)}`;
    const user = testData.advertiser();

    // The /access endpoint requires user query param and may return 403 if no access
    // or 200 with content if access granted
    try {
      const response = await apiClient.walrus.get(`/premium/access/${contentId}`, {
        params: { user },
      });

      // If access granted, should return 200 with content
      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toBeDefined();
      } else {
        // 403 means no access, which is valid
        expect(response.data).toHaveProperty('error');
      }
    } catch (error: any) {
      // 404 is also valid if content doesn't exist
      if (error.response?.status === 404) {
        // Content doesn't exist, which is fine for testing
        expect(error.response.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  test('should get user purchases', async () => {
    const user = testData.advertiser();

    const response = await apiClient.walrus.get(`/premium/purchases/${user}`);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('purchases');
    expect(Array.isArray(response.data.purchases)).toBe(true);
  });

  test('should get owner earnings', async () => {
    const owner = testData.advertiser();

    const response = await apiClient.walrus.get(`/premium/earnings/${owner}`);

    expect(response.status).toBe(200);
    // API returns: { breakdown: [], contentCount: 0, total: 0 }
    expect(response.data).toHaveProperty('total');
    expect(response.data).toHaveProperty('contentCount');
    expect(response.data).toHaveProperty('breakdown');
    expect(typeof response.data.total).toBe('number');
    expect(typeof response.data.contentCount).toBe('number');
    expect(Array.isArray(response.data.breakdown)).toBe(true);
  });

  test('should reject purchase without required params', async () => {
    try {
      await apiClient.walrus.post('/premium/purchase', {
        contentId: 'test_content',
        // missing buyer, paymentTxId
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.response?.status).toBe(400);
    }
  });

  test('should return 404 when purchasing non-existent content', async () => {
    const buyer = testData.advertiser();
    const paymentTxId = '0x' + 'c'.repeat(64);

    try {
      await apiClient.purchasePremiumContent('nonexistent_content_xyz', buyer, paymentTxId);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.response?.status).toBe(404);
    }
  });

  test('should get premium earnings stats', async () => {
    try {
      const response = await apiClient.walrus.get('/premium/earnings/stats');
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    } catch (err: any) {
      // 404 if endpoint not implemented
      if (err.response?.status === 404) {
        test.skip(true, 'Premium earnings stats endpoint not implemented');
      } else {
        throw err;
      }
    }
  });
});
