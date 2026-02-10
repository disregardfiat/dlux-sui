/**
 * E2E tests for subscription API (platform-wide ad-free)
 * Tests: Create subscription (subscriber pays foundation), get status
 */

import { test, expect } from '@playwright/test';
import { apiClient } from './helpers/api-helpers';
import { testData } from './helpers/test-data';

test.describe('Subscription API E2E', () => {
  const subscriber = testData.advertiser();

  test.beforeAll(async () => {
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    if (!dgraphHealthy) {
      test.skip(true, 'DGraph service not available (DGRAPH_SERVICE_URL)');
      return;
    }
    expect(dgraphHealthy).toBe(true);
  });

  test('should create subscription (requires JWT as subscriber; may skip when no auth)', async () => {
    try {
      const result = await apiClient.createSubscription({
        subscriber,
        paymentTxId: '0x' + 'c'.repeat(64),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('subscriber', subscriber);
      expect(result).toHaveProperty('recipient');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('paymentTxId');
    } catch (err: any) {
      if (err.response?.status === 403) {
        test.skip(true, 'Create subscription requires JWT as subscriber (personal-data restriction)');
      }
      throw err;
    }
  });

  test('should get subscription status (active always; subscriptions only when JWT as subscriber)', async () => {
    const result = await apiClient.getSubscriptionStatus(subscriber);

    expect(result).toHaveProperty('active');
    expect(typeof result.active).toBe('boolean');
    const subs = result.subscriptions ?? [];
    expect(Array.isArray(subs)).toBe(true);
    if (result.active && subs.length > 0) {
      expect(subs[0]).toHaveProperty('recipient');
    }
  });

  test('should reject create without required params', async () => {
    try {
      await apiClient.dgraph.post('/subscription', {
        subscriber,
        // missing paymentTxId
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.response?.status).toBe(400);
    }
  });
});
