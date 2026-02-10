/**
 * E2E tests for Prediction Market flow
 * Tests: Create market → Place bet → Get payouts
 */

import { test, expect } from '@playwright/test';
import { apiClient } from './helpers/api-helpers';
import { testData } from './helpers/test-data';

test.describe('Prediction Market E2E Flow', () => {
  let marketId: string;
  const bettor = testData.advertiser();

  test.beforeAll(async () => {
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    if (!dgraphHealthy) {
      test.skip('DGraph/GQL service not available (PM data served from gql.dlux.io)');
      return;
    }
  });

  test('should create a prediction market', async () => {
    const result = await apiClient.createMarket({
      dappId: 'e2e_test_dapp_' + Date.now(),
      safetyMetric: 'content_safety',
    });
    expect(result).toHaveProperty('transactionId');
    // PM service returns tx id; market may be created async via indexer
    marketId = result.transactionId || result.marketId || 'mock_market_1';
  });

  test('should place a bet on market', async () => {
    const markets = await apiClient.getHighPayoutMarkets(5);
    const mkt = markets?.markets?.[0]?.id || marketId || 'e2e_market_1';
    const result = await apiClient.placeBet(mkt, {
      bettor,
      side: 'safe',
      amount: 1.0,
    });
    expect(result).toHaveProperty('transactionId');
  });

  test('should get payouts for owner', async () => {
    const result = await apiClient.getPayouts(bettor);
    expect(result).toHaveProperty('total');
    expect(typeof result.total).toBe('number');
  });
});
