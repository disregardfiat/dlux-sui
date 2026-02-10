/**
 * ZK Proofs API tests
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/index';

// Mock the proof generator
jest.mock('../src/services/proofGenerator', () => ({
  proofGenerator: {
    initialize: jest.fn().mockResolvedValue(undefined),
    generateAdViewProof: jest.fn().mockResolvedValue({
      proof: 'mock-proof-data',
      publicSignals: ['signal1', 'signal2'],
      proofHash: 'hash-123'
    }),
    verifyProof: jest.fn().mockResolvedValue(true),
  }
}));

// Mock the homomorphic encryption
jest.mock('../src/services/homomorphicEncryption', () => ({
  homomorphicEncryption: {
    initialize: jest.fn().mockResolvedValue(undefined),
    encryptViewerIdentity: jest.fn().mockReturnValue('encrypted-viewer-id'),
    encryptImpression: jest.fn().mockReturnValue('encrypted-impression'),
    aggregateImpressions: jest.fn().mockReturnValue('aggregated-value'),
    decryptAggregate: jest.fn().mockReturnValue(42),
  }
}));

describe('ZK Service', () => {
  describe('GET /health', () => {
    it('should return service health status', async () => {
      const res = await request(app).get('/health');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('service', 'zk-service');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});

describe('Proofs API', () => {
  describe('POST /proofs/generate', () => {
    it('should require all fields', async () => {
      const res = await request(app)
        .post('/proofs/generate')
        .send({
          adId: 'ad-123'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    it('should generate ZK ad view proof with valid data', async () => {
      const res = await request(app)
        .post('/proofs/generate')
        .send({
          adId: 'ad-123',
          viewerIdentity: '0x1234567890abcdef',
          contentId: 'content-456',
          blockHeader: 'block-hash-789',
          secretSalt: 'salt-xyz'
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('proof');
      expect(res.body).toHaveProperty('publicSignals');
      expect(res.body).toHaveProperty('proofHash');
      expect(res.body).toHaveProperty('encryptedViewer');
    });
  });

  describe('POST /proofs/generate-click', () => {
    it('should generate ZK click proof with valid data', async () => {
      const res = await request(app)
        .post('/proofs/generate-click')
        .send({
          adId: 'ad-123',
          viewerIdentity: '0x1234567890abcdef',
          contentId: 'content-456',
          blockHeader: 'block-hash-789',
          secretSalt: 'salt-xyz'
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('proof');
    });
  });

  describe('POST /proofs/generate-conversion', () => {
    it('should generate ZK conversion proof with valid data', async () => {
      const res = await request(app)
        .post('/proofs/generate-conversion')
        .send({
          adId: 'ad-123',
          viewerIdentity: '0x1234567890abcdef',
          contentId: 'content-456',
          blockHeader: 'block-hash-789',
          secretSalt: 'salt-xyz'
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('proof');
    });
  });

  describe('POST /proofs/verify', () => {
    it('should require proof and publicSignals', async () => {
      const res = await request(app)
        .post('/proofs/verify')
        .send({ proof: 'mock-proof-data' });
      
      expect(res.status).toBe(400);
    });

    it('should verify ZK proof', async () => {
      const res = await request(app)
        .post('/proofs/verify')
        .send({
          proof: 'mock-proof-data',
          publicSignals: ['signal1', 'signal2']
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('valid');
      expect(res.body.valid).toBe(true);
    });
  });

  describe('POST /proofs/aggregate', () => {
    it('should require encryptedImpressions array', async () => {
      const res = await request(app)
        .post('/proofs/aggregate')
        .send({
          encryptedImpressions: 'not-an-array'
        });
      
      expect(res.status).toBe(400);
    });

    it('should perform homomorphic aggregation', async () => {
      const res = await request(app)
        .post('/proofs/aggregate')
        .send({
          encryptedImpressions: ['enc1', 'enc2', 'enc3']
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('encryptedAggregate');
    });
  });
});
