import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { campaignsRouter } from '../src/routes/campaigns';
import adsRouter from '../src/routes/ads';
import impressionsRouter from '../src/routes/impressions';
import { analyticsRouter } from '../src/routes/analytics';
import { attachAuth } from '../src/middleware/auth';
import { campaignRepository } from '../src/repositories/campaignRepository';
import { impressionRepository } from '../src/repositories/impressionRepository';
import { adEventRepository } from '../src/repositories/adEventRepository';

process.env.NODE_ENV = 'test';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function authHeader(suiAddress: string): string {
  const token = jwt.sign({ suiAddress, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
  return `Bearer ${token}`;
}

jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: { valid: true, encryptedAggregate: 'enc' } }),
  get: jest.fn().mockResolvedValue({ data: { latestBlock: { blockHash: 'block' } } })
}));

const app = express();
app.use(express.json());
app.use(attachAuth);
app.use('/campaigns', campaignsRouter);
app.use('/ads', adsRouter);
app.use('/impressions', impressionsRouter);
app.use('/analytics', analyticsRouter);

describe('Ad campaigns + analytics', () => {
  beforeEach(() => {
    campaignRepository.clearTestData();
    impressionRepository.clearTestData();
    adEventRepository.clearTestData();
  });

  it('creates, lists, pauses/resumes a campaign', async () => {
    const bearer = authHeader('0xabc');
    const createRes = await request(app).post('/campaigns').set('Authorization', bearer).send({
      advertiser: '0xabc',
      title: 'Test Campaign',
      description: 'desc',
      targetUrl: 'https://example.com',
      placements: ['gate'],
      bid: 0.01,
      totalBudget: 1
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toHaveProperty('id');

    const listRes = await request(app).get('/campaigns').set('Authorization', bearer).query({ advertiser: '0xabc' });
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(1);

    const pauseRes = await request(app).post(`/campaigns/${createRes.body.id}/pause`).send({});
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.status).toBe('paused');

    const resumeRes = await request(app).post(`/campaigns/${createRes.body.id}/resume`).send({});
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.status).toBe('active');
  });

  it('selects a campaign ad via /ads/select and returns analytics', async () => {
    const bearer = authHeader('0xabc');
    const campaignRes = await request(app).post('/campaigns').set('Authorization', bearer).send({
      advertiser: '0xabc',
      title: 'High Bid',
      targetUrl: 'https://example.com',
      placements: ['gate'],
      bid: 0.02,
      totalBudget: 1
    });
    const campaignId = campaignRes.body.id;

    const selectRes = await request(app).post('/ads/select').send({ placement: 'gate', contentId: 'dapp_1' });
    expect(selectRes.status).toBe(200);
    expect(selectRes.body.ad.id).toBe(campaignId);

    const impRes = await request(app).post('/impressions').send({
      adId: campaignId,
      contentId: 'dapp_1',
      zkProof: { proof: { a: 1 }, publicSignals: ['1'] },
      proofHash: 'hash',
      encryptedViewer: 'enc',
      blockHeader: 'block'
    });
    expect(impRes.status).toBe(200);

    const analyticsRes = await request(app).get(`/analytics/campaign/${campaignId}`);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.impressions).toBeGreaterThanOrEqual(1);
    expect(analyticsRes.body).toHaveProperty('ctr');
  });

  it('stores and returns onChainCampaignId and onChainEscrowId on campaign', async () => {
    const bearer = authHeader('0xabc');
    const createRes = await request(app).post('/campaigns').set('Authorization', bearer).send({
      advertiser: '0xabc',
      title: 'On-chain Campaign',
      targetUrl: 'https://example.com',
      placements: ['gate'],
      bid: 0.01,
      totalBudget: 1
    });
    expect(createRes.status).toBe(201);
    const campaignId = createRes.body.id;

    const onChainCampaignId = '0xcampaign123';
    const onChainEscrowId = '0xescrow456';
    const updateRes = await request(app).put(`/campaigns/${campaignId}`).send({
      onChainCampaignId,
      onChainEscrowId
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.onChainCampaignId).toBe(onChainCampaignId);
    expect(updateRes.body.onChainEscrowId).toBe(onChainEscrowId);

    const getRes = await request(app).get(`/campaigns/${campaignId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.onChainCampaignId).toBe(onChainCampaignId);
    expect(getRes.body.onChainEscrowId).toBe(onChainEscrowId);
  });

  it('lists impressions with settled filter and marks them settled', async () => {
    const bearer = authHeader('0xabc');
    const campaignRes = await request(app).post('/campaigns').set('Authorization', bearer).send({
      advertiser: '0xabc',
      title: 'Settle Test',
      targetUrl: 'https://example.com',
      placements: ['gate'],
      bid: 0.01,
      totalBudget: 1
    });
    const adId = campaignRes.body.id;

    await request(app).post('/impressions').send({
      adId,
      contentId: 'dapp_1',
      zkProof: { proof: { a: 1 }, publicSignals: ['1'] },
      proofHash: 'h1',
      encryptedViewer: 'enc',
      blockHeader: 'block'
    });

    const listUnsettled = await request(app).get('/impressions').query({ adId, verified: true, settled: false });
    expect(listUnsettled.status).toBe(200);
    expect(listUnsettled.body.impressions.length).toBeGreaterThanOrEqual(1);
    const impressionId = listUnsettled.body.impressions[0].id;

    const settleRes = await request(app).post('/impressions/settle').send({ impressionIds: [impressionId] });
    expect(settleRes.status).toBe(200);
    expect(settleRes.body.success).toBe(true);
    expect(settleRes.body.count).toBe(1);

    const listSettled = await request(app).get('/impressions').query({ adId, settled: true });
    expect(listSettled.status).toBe(200);
    expect(listSettled.body.impressions.length).toBeGreaterThanOrEqual(1);
  });
});

