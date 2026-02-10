/**
 * E2E tests for ad campaign flow
 * Tests: Create campaign → Select ad → Record impression → Verify analytics
 */

import { test, expect } from '@playwright/test';
import { apiClient, isDeployedDluxEnv } from './helpers/api-helpers';
import { testData } from './helpers/test-data';

test.describe('Ad Campaign E2E Flow', () => {
  let campaignId: string;
  let advertiser: string;
  let campaignsWritable = true;

  test.beforeAll(async () => {
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    if (!dgraphHealthy) {
      test.skip(true, 'DGraph service not available (DGRAPH_SERVICE_URL)');
      return;
    }
    if (isDeployedDluxEnv()) {
      campaignsWritable = false;
    }
  });

  test('should create a campaign', async () => {
    if (!campaignsWritable) {
      test.skip(true, 'Campaign create returns 403 on deployed DGraph (write restricted)');
      return;
    }
    advertiser = testData.advertiser();
    const campaignData = testData.campaign({ advertiser });

    const campaign = await apiClient.createCampaign(campaignData);

    expect(campaign).toHaveProperty('id');
    expect(campaign.advertiser).toBe(advertiser);
    expect(campaign.title).toBe(campaignData.title);
    expect(campaign.status).toBe('active');
    expect(campaign.bid).toBe(campaignData.bid);
    expect(campaign.totalBudget).toBe(campaignData.totalBudget);
    expect(campaign.remainingBudget).toBe(campaignData.totalBudget);

    campaignId = campaign.id;
  });

  test('should retrieve created campaign', async () => {
    if (!campaignsWritable) {
      test.skip(true, 'Campaign create returns 403 on deployed DGraph (write restricted)');
      return;
    }
    expect(campaignId).toBeDefined();

    const campaign = await apiClient.getCampaign(campaignId);

    expect(campaign.id).toBe(campaignId);
    expect(campaign.advertiser).toBe(advertiser);
    expect(campaign.status).toBe('active');
  });

  test('should list campaigns by advertiser', async () => {
    if (!campaignsWritable) {
      test.skip(true, 'Campaign create returns 403 on deployed DGraph (write restricted)');
      return;
    }
    const result = await apiClient.listCampaigns({ advertiser });

    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('campaigns');
    expect(Array.isArray(result.campaigns)).toBe(true);
    expect(result.campaigns.length).toBeGreaterThan(0);
    expect(result.campaigns.some((c: any) => c.id === campaignId)).toBe(true);
  });

  test('should select ad for placement', async () => {
    const adSelection = await apiClient.selectAd({
      placement: 'gate',
      contentId: 'dapp_test_123',
    });

    expect(adSelection).toHaveProperty('ad');
    if (adSelection.ad) {
      expect(adSelection.ad).toHaveProperty('id');
      expect(adSelection.ad).toHaveProperty('title');
      expect(adSelection.ad).toHaveProperty('targetUrl');
    }
  });

  test('should record impression', async () => {
    if (!campaignsWritable) {
      test.skip(true, 'Campaign create returns 403 on deployed DGraph (write restricted)');
      return;
    }
    expect(campaignId).toBeDefined();

    const impressionData = testData.impression({ adId: campaignId });
    const result = await apiClient.createImpression(impressionData);

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('impressionId');
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('thresholdReached');
  });

  test('should pause and resume campaign', async () => {
    if (!campaignsWritable) {
      test.skip(true, 'Campaign create returns 403 on deployed DGraph (write restricted)');
      return;
    }
    expect(campaignId).toBeDefined();

    // Pause
    const paused = await apiClient.pauseCampaign(campaignId);
    expect(paused.status).toBe('paused');

    // Verify paused
    const campaign = await apiClient.getCampaign(campaignId);
    expect(campaign.status).toBe('paused');

    // Resume
    const resumed = await apiClient.resumeCampaign(campaignId);
    expect(resumed.status).toBe('active');

    // Verify resumed
    const campaign2 = await apiClient.getCampaign(campaignId);
    expect(campaign2.status).toBe('active');
  });

  test('should get campaign analytics', async () => {
    if (!campaignsWritable) {
      test.skip(true, 'Campaign create returns 403 on deployed DGraph (write restricted)');
      return;
    }
    expect(campaignId).toBeDefined();

    const analytics = await apiClient.getCampaignAnalytics(campaignId);

    expect(analytics).toHaveProperty('campaignId', campaignId);
    expect(analytics).toHaveProperty('advertiser', advertiser);
    expect(analytics).toHaveProperty('impressions');
    expect(analytics).toHaveProperty('clicks');
    expect(analytics).toHaveProperty('conversions');
    expect(analytics).toHaveProperty('spend');
    expect(analytics).toHaveProperty('ctr');
    expect(analytics).toHaveProperty('conversionRate');
    expect(typeof analytics.impressions).toBe('number');
    expect(typeof analytics.clicks).toBe('number');
    expect(typeof analytics.conversions).toBe('number');
  });

  test('should get advertiser analytics', async () => {
    if (!campaignsWritable) {
      test.skip(true, 'Campaign create returns 403 on deployed DGraph (write restricted)');
      return;
    }
    expect(advertiser).toBeDefined();

    const analytics = await apiClient.getAdvertiserAnalytics(advertiser);

    expect(analytics).toHaveProperty('advertiser', advertiser);
    expect(analytics).toHaveProperty('campaigns');
    expect(analytics).toHaveProperty('impressions');
    expect(analytics).toHaveProperty('clicks');
    expect(analytics).toHaveProperty('conversions');
    expect(analytics).toHaveProperty('spend');
    expect(analytics).toHaveProperty('ctr');
    expect(analytics).toHaveProperty('conversionRate');
  });

  test('should cancel campaign', async () => {
    if (!campaignsWritable) {
      test.skip(true, 'Campaign create returns 403 on deployed DGraph (write restricted)');
      return;
    }
    expect(campaignId).toBeDefined();

    const result = await apiClient.cancelCampaign(campaignId);
    expect(result).toHaveProperty('success', true);

    // Verify cancelled
    const campaign = await apiClient.getCampaign(campaignId);
    expect(campaign.status).toBe('cancelled');
  });
});
