/**
 * Vanity Address tests
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/index';
import { vanityRepository } from '../src/repositories/vanityRepository';
import { vanityFactory } from '../../../tests/utils/factories';

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

describe('Vanity Address', () => {
  beforeEach(() => {
    // Clear vanity repository before each test
    // Note: This is a simplified approach - in production we'd use a test database
  });

  describe('GET /vanity/check/:vanity', () => {
    it('should check if vanity is available', async () => {
      const res = await request(app)
        .get('/vanity/check/testuser');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('available');
      expect(res.body).toHaveProperty('price');
      expect(res.body).toHaveProperty('vanity', 'testuser');
      expect(res.body.available).toBe(true);
      expect(typeof res.body.price).toBe('number');
    });

    it('should return false for taken vanity', async () => {
      // Create existing vanity by directly using the repository
      const testVanity = vanityFactory.create({
        address: 'testuser',
        owner: '0x1234567890abcdef1234567890abcdef12345678'
      });
      await vanityRepository.save(testVanity);
      
      const res = await request(app)
        .get('/vanity/check/testuser');
      
      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
    });
  });

  describe('POST /vanity/purchase', () => {
    it('should purchase available vanity address', async () => {
      const suiAddress = '0x1234567890abcdef1234567890abcdef12345678';
      const signature = 'mock-signature-valid';
      
      const res = await request(app)
        .post('/vanity/purchase')
        .send({
          vanity: 'testuser',
          suiAddress,
          signature,
          price: 10
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('address', 'testuser');
      expect(res.body).toHaveProperty('owner', suiAddress);
    });

    it('should reject purchase of taken vanity', async () => {
      // Create existing vanity
      const existingVanity = vanityFactory.create({
        address: 'testuser',
        owner: '0x4567890abcdef1234567890abcdef1234567890ab'
      });
      await vanityRepository.save(existingVanity);
      
      const res = await request(app)
        .post('/vanity/purchase')
        .send({
          vanity: 'testuser',
          suiAddress: '0x1234567890abcdef1234567890abcdef12345678',
          signature: 'sig',
          price: 10
        });
      
      expect(res.status).toBe(500); // Service throws error, route returns 500
      expect(res.body).toHaveProperty('error');
    });

    it('should require all fields', async () => {
      const res = await request(app)
        .post('/vanity/purchase')
        .send({
          vanity: 'testuser'
          // Missing suiAddress and signature
        });
      
      expect(res.status).toBe(400);
    });
  });
});
