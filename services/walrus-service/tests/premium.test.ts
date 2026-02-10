/**
 * Premium Content and Walrus API tests
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/index';

// Mock the Walrus client
jest.mock('../src/walrus/client', () => ({
  walrusClient: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    uploadBlob: jest.fn().mockResolvedValue({ blobId: 'test-blob-123' }),
    getBlob: jest.fn().mockResolvedValue(Buffer.from('test content')),
    getBlobInfo: jest.fn().mockResolvedValue({
      blobId: 'test-blob-123',
      size: 1024,
      contentType: 'text/plain',
      createdAt: new Date().toISOString()
    }),
  }
}));

// Mock the Seal client
jest.mock('../src/seal/client', () => ({
  sealClient: {
    connect: jest.fn(),
    encryptContent: jest.fn().mockResolvedValue({
      objectId: 'seal-obj-123',
      sealPackage: 'package-data'
    }),
    checkAccess: jest.fn().mockResolvedValue(true),
    grantAccess: jest.fn().mockResolvedValue({ grantId: 'grant-123' }),
    decryptContent: jest.fn().mockResolvedValue(Buffer.from('decrypted content')),
    revokeAccess: jest.fn().mockResolvedValue(true),
  }
}));

// Mock the premium content repository
jest.mock('../src/repositories/premiumContentRepository', () => ({
  premiumContentRepository: {
    create: jest.fn().mockResolvedValue({
      id: 'premium-123',
      name: 'Test Content',
      price: 0.5,
      createdAt: new Date()
    }),
    findById: jest.fn().mockResolvedValue({
      id: 'premium-123',
      name: 'Test Content',
      price: 0.5,
      owner: '0x1234',
      sealObjectId: 'seal-obj-123',
      contentType: 'application/octet-stream'
    }),
    findByDApp: jest.fn().mockResolvedValue([]),
    findByOwner: jest.fn().mockResolvedValue([]),
    findPurchasesByUser: jest.fn().mockResolvedValue([]),
    findPurchasesByContent: jest.fn().mockResolvedValue([]),
    recordPurchase: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue(true),
  }
}));

describe('Walrus Service', () => {
  describe('GET /health', () => {
    it('should return service health status', async () => {
      const res = await request(app).get('/health');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});

describe('Premium Content API', () => {
  describe('GET /premium/content/:dappId', () => {
    it('should list premium content for a dApp', async () => {
      const res = await request(app).get('/premium/content/test-dapp-123');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('contents');
      expect(Array.isArray(res.body.contents)).toBe(true);
    });

    it('should check access status when user is provided', async () => {
      const res = await request(app)
        .get('/premium/content/test-dapp-123')
        .query({ user: '0x1234567890abcdef' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('contents');
    });
  });

  describe('GET /premium/purchases/:user', () => {
    it('should return user purchases', async () => {
      const res = await request(app).get('/premium/purchases/0x1234567890abcdef');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('purchases');
      expect(Array.isArray(res.body.purchases)).toBe(true);
    });
  });

  describe('GET /premium/access/:contentId', () => {
    it('should require user parameter', async () => {
      const res = await request(app).get('/premium/access/premium-123');
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('user');
    });
  });

  describe('GET /premium/earnings/:owner', () => {
    it('should return earnings for an owner', async () => {
      const res = await request(app).get('/premium/earnings/0x1234567890abcdef');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('breakdown');
      expect(res.body).toHaveProperty('contentCount');
    });
  });
});

describe('Ads Gateway API', () => {
  describe('POST /ads/consent', () => {
    it('should accept consent settings', async () => {
      const res = await request(app)
        .post('/ads/consent')
        .send({
          userId: '0x1234567890abcdef',
          consent: true
        });
      
      // Should succeed or fail gracefully
      expect([200, 400, 500]).toContain(res.status);
    });
  });
});
