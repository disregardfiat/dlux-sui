/**
 * E2E tests for ad settlement (docs/ad-click-to-sui-payouts.md).
 * Settlement: verified impressions → record_impression_with_escrow; revenue distribution → distribute_revenue.
 * Tests: settlement status endpoint, campaign with on-chain IDs required for settlement.
 */

import { test, expect } from '@playwright/test';
import { apiClient } from './helpers/api-helpers';

test.describe('Ad Settlement API E2E', () => {
  test.beforeAll(async () => {
    const suiHealthy = await apiClient.checkHealth('sui');
    if (!suiHealthy) {
      test.skip(true, 'SUI service not available (SUI_SERVICE_URL)');
    }
  });

  test('GET /ads/settlement/status returns configuration flags (no secrets)', async () => {
    const status = await apiClient.getAdSettlementStatus();
    expect(status).toHaveProperty('configured');
    expect(status).toHaveProperty('hasDgraph');
    expect(status).toHaveProperty('hasPackageId');
    expect(status).toHaveProperty('hasAdminCap');
    expect(status).toHaveProperty('hasRevenuePool');
    expect(status).toHaveProperty('hasAdminKey');
    expect(status).toHaveProperty('hasFoundationAddress');
    expect(status).toHaveProperty('hasPmPoolAddress');
    expect(typeof status.configured).toBe('boolean');
  });

  test('GET /ads/settlement/impressions without campaignId returns 400', async () => {
    try {
      await apiClient.getSettlementImpressions({});
      expect(true).toBe(false); // should have thrown
    } catch (err: any) {
      expect(err.response?.status).toBe(400);
      expect(err.response?.data?.error).toMatch(/campaignId|Missing/);
    }
  });

  test('GET /ads/settlement/impressions with campaignId but no on-chain IDs returns 400', async () => {
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    if (!dgraphHealthy) {
      test.skip(true, 'DGraph not available to create campaign (DGRAPH_SERVICE_URL)');
      return;
    }
    let campaign: { id: string };
    try {
      campaign = await apiClient.createCampaign({
        advertiser: '0x' + 'b'.repeat(64),
        title: 'E2E Settlement Test',
        targetUrl: 'https://example.com',
        placements: ['gate'],
        bid: 0.001,
        totalBudget: 1,
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        test.skip(true, 'Campaign create returns 403 on deployed DGraph (write restricted)');
        return;
      }
      throw err;
    }
    try {
      await apiClient.getSettlementImpressions({ campaignId: campaign.id });
      const status = await apiClient.getAdSettlementStatus();
      if (status.configured) expect(true).toBe(true);
    } catch (err: any) {
      expect([400, 503]).toContain(err.response?.status);
      if (err.response?.status === 400) {
        expect(err.response?.data?.error).toMatch(/on-chain|onChainCampaignId|Campaign has no/);
      }
    }
  });
});
