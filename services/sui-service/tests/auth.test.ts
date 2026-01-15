/**
 * Authentication tests
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/index';

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

describe('Authentication', () => {
  beforeEach(() => {
    // Reset mocks before each test
  });

  describe('POST /auth/challenge', () => {
    it('should generate authentication challenge', async () => {
      const res = await request(app)
        .post('/auth/challenge')
        .send({ suiAddress: '0x1234567890abcdef1234567890abcdef12345678' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('challenge');
      expect(res.body).toHaveProperty('expiresAt');
      expect(typeof res.body.challenge).toBe('string');
    });

    it('should require suiAddress', async () => {
      const res = await request(app)
        .post('/auth/challenge')
        .send({});
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/zk-login', () => {
    it('should authenticate user with valid signature', async () => {
      // First get a challenge
      const challengeRes = await request(app)
        .post('/auth/challenge')
        .send({ suiAddress: '0x1234567890abcdef1234567890abcdef12345678' });
      
      expect(challengeRes.status).toBe(200);
      const challengeId = challengeRes.body.challengeId;
      const signature = 'mock-signature-valid';
      
      const res = await request(app)
        .post('/auth/zk-login')
        .send({
          suiAddress: '0x1234567890abcdef1234567890abcdef12345678',
          signature,
          challengeId
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('suiAddress');
    });

    it('should reject invalid signature', async () => {
      // Get a valid challenge first
      const challengeRes = await request(app)
        .post('/auth/challenge')
        .send({ suiAddress: '0x1234567890abcdef1234567890abcdef12345678' });
      
      const challengeId = challengeRes.body.challengeId;
      
      const res = await request(app)
        .post('/auth/zk-login')
        .send({
          suiAddress: '0x1234567890abcdef1234567890abcdef12345678',
          signature: '', // Empty signature should fail
          challengeId
        });
      
      expect(res.status).toBe(401);
    });

    it('should require all fields', async () => {
      const res = await request(app)
        .post('/auth/zk-login')
        .send({
          suiAddress: '0x1234567890abcdef1234567890abcdef12345678'
          // Missing signature
        });
      
      expect(res.status).toBe(400);
    });
  });
});
