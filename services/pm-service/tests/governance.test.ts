/**
 * Governance API tests
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/index';

// Mock the dgraph client
jest.mock('../src/repositories/dgraphClient', () => ({
  pmDgraphClient: {
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue({ variables: [], markets: [] }),
    mutate: jest.fn().mockResolvedValue({}),
  }
}));

// Mock the scheduler
jest.mock('../src/services/scheduler', () => ({
  schedulerService: {
    start: jest.fn(),
    stop: jest.fn(),
  }
}));

describe('Governance API', () => {
  describe('GET /health', () => {
    it('should return service health status', async () => {
      const res = await request(app).get('/health');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('service', 'pm-service');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /governance/variables', () => {
    it('should return governance variables', async () => {
      const res = await request(app).get('/governance/variables');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('variables');
      expect(Array.isArray(res.body.variables)).toBe(true);
    });
  });

  describe('GET /governance/markets', () => {
    it('should return active governance markets', async () => {
      const res = await request(app).get('/governance/markets');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('markets');
      expect(Array.isArray(res.body.markets)).toBe(true);
    });

    it('should also work via /governance/markets/active for backward compatibility', async () => {
      const res = await request(app).get('/governance/markets/active');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('markets');
      expect(Array.isArray(res.body.markets)).toBe(true);
    });
  });

  describe('POST /governance/markets', () => {
    it('should require all fields', async () => {
      const res = await request(app)
        .post('/governance/markets')
        .send({ variable: 'foundationShare' });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should create governance market with valid data', async () => {
      const res = await request(app)
        .post('/governance/markets')
        .send({
          variable: 'foundationShare',
          proposedValue: '0.45',
          triggeredBy: 'sui-tx-123',
          triggeredByAddress: '0x1234567890abcdef'
        });
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('transactionId');
    });
  });

  describe('POST /governance/markets/:marketId/bet', () => {
    it('should require bettor, side, and amount', async () => {
      const res = await request(app)
        .post('/governance/markets/test-market-123/bet')
        .send({ bettor: '0x123' });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should validate side value', async () => {
      const res = await request(app)
        .post('/governance/markets/test-market-123/bet')
        .send({
          bettor: '0x1234567890abcdef',
          side: 'invalid',
          amount: 1.0
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('yes');
    });

    it('should place bet with valid data', async () => {
      const res = await request(app)
        .post('/governance/markets/test-market-123/bet')
        .send({
          bettor: '0x1234567890abcdef',
          side: 'yes',
          amount: 1.0
        });
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('transactionId');
    });
  });
});

describe('Markets API', () => {
  describe('GET /markets/high-payout', () => {
    it('should return high payout markets', async () => {
      const res = await request(app).get('/markets/high-payout');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('markets');
      expect(res.body).toHaveProperty('limit');
    });

    it('should accept limit parameter', async () => {
      const res = await request(app).get('/markets/high-payout?limit=5');
      
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(5);
    });
  });

  describe('GET /markets/fees/:dappId', () => {
    it('should return fees for a dApp', async () => {
      const res = await request(app).get('/markets/fees/test-dapp-123');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('markets');
    });
  });

  describe('GET /markets/payouts/:owner', () => {
    it('should return payouts for an owner', async () => {
      const res = await request(app).get('/markets/payouts/0x1234567890abcdef');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
    });
  });
});
