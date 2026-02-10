/**
 * dApp lookup tests
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/index';
import { dappRepository } from '../src/repositories/dappRepository';

// Mock the SUI client to avoid actual blockchain calls in tests
jest.mock('../src/sui/client', () => ({
  suiClient: {
    connect: jest.fn(),
    getObject: jest.fn(),
  }
}));

// Mock the indexer
jest.mock('../src/sui/indexer', () => ({
  indexer: {
    start: jest.fn(),
    stop: jest.fn(),
  }
}));

describe('dApps', () => {
  beforeEach(() => {
    dappRepository.clearTestData();
  });

  describe('GET /dapps/lookup', () => {
    it('returns metadata for author + permlink', async () => {
      await dappRepository.save({
        id: 'dapp_test',
        name: 'Test dApp',
        description: 'Sample description',
        owner: '0xabc',
        permlink: 'test-dapp',
        version: '1.0.0',
        manifest: { metadata: { labels: ['remixable'] } },
        blobIds: [],
        tags: ['vr', '360'],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const res = await request(app)
        .get('/dapps/lookup')
        .query({ author: '0xabc', permlink: 'test-dapp' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({
        id: 'dapp_test',
        name: 'Test dApp',
        owner: '0xabc',
        permlink: 'test-dapp',
        tags: ['vr', '360'],
        labels: ['remixable']
      }));
    });

    it('returns 400 when missing params', async () => {
      const res = await request(app)
        .get('/dapps/lookup');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 404 when not found', async () => {
      const res = await request(app)
        .get('/dapps/lookup')
        .query({ author: '0xabc', permlink: 'missing' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });
});
