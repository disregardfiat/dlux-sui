/**
 * Vanity Address tests
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/index';
import { profileRepository } from '../src/repositories/profileRepository';

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

jest.mock('../src/services/suinsService', () => ({
  suinsService: {
    isAvailable: jest.fn(),
    resolveName: jest.fn(),
    reverseResolve: jest.fn()
  }
}));

const { suinsService } = jest.requireMock('../src/services/suinsService');

describe('Vanity Address', () => {
  beforeEach(() => {
    profileRepository.clearTestData();
    suinsService.isAvailable.mockReset();
    suinsService.resolveName.mockReset();
    suinsService.reverseResolve.mockReset();
  });

  describe('GET /vanity/check/:vanity', () => {
    it('should check if vanity is available', async () => {
      suinsService.isAvailable.mockResolvedValue(true);

      const res = await request(app)
        .get('/vanity/check/testuser');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('available');
      expect(res.body).toHaveProperty('vanity', 'testuser');
      expect(res.body.available).toBe(true);
    });

    it('should return false for taken vanity', async () => {
      suinsService.isAvailable.mockResolvedValue(false);
      
      const res = await request(app)
        .get('/vanity/check/testuser');
      
      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
    });
  });

  describe('POST /vanity/purchase', () => {
    it('should return 501 to use SuiNS', async () => {
      const res = await request(app)
        .post('/vanity/purchase')
        .send({
          vanity: 'testuser',
          suiAddress: '0x1234567890abcdef1234567890abcdef12345678',
          signature: 'sig'
        });

      expect(res.status).toBe(501);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /vanity/:identifier', () => {
    it('should return profile resolved from SuiNS', async () => {
      const owner = '0x1234567890abcdef1234567890abcdef12345678';
      suinsService.resolveName.mockResolvedValue(owner);
      suinsService.reverseResolve.mockResolvedValue('testuser');

      await profileRepository.upsertProfile(owner, {
        displayName: 'Test User',
        bio: 'Hello',
        socialLinks: [],
        metadata: {}
      }, 'testuser');

      const res = await request(app)
        .get('/vanity/testuser');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('owner', owner);
      expect(res.body).toHaveProperty('suinsName', 'testuser');
      expect(res.body.profile.displayName).toBe('Test User');
    });
  });
});
