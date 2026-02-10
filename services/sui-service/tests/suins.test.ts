/**
 * SuiNS tests
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

describe('SuiNS', () => {
  beforeEach(() => {
    profileRepository.clearTestData();
    suinsService.isAvailable.mockReset();
    suinsService.resolveName.mockReset();
    suinsService.reverseResolve.mockReset();
    delete process.env.SUINS_REGISTRATION_URL;
    delete process.env.SUINS_REFERRAL_CODE;
    delete process.env.SUINS_REFERRAL_PARAM;
  });

  describe('GET /suins/availability/:name', () => {
    it('returns availability when configured', async () => {
      suinsService.isAvailable.mockResolvedValue(true);

      const res = await request(app)
        .get('/suins/availability/testuser');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ available: true, name: 'testuser' });
    });

    it('returns 503 when unavailable', async () => {
      suinsService.isAvailable.mockResolvedValue(null);

      const res = await request(app)
        .get('/suins/availability/testuser');

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /suins/resolve/:name', () => {
    it('returns resolved address', async () => {
      suinsService.resolveName.mockResolvedValue('0xabc');

      const res = await request(app)
        .get('/suins/resolve/testuser');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ name: 'testuser', address: '0xabc' });
    });

    it('returns 404 when not found', async () => {
      suinsService.resolveName.mockResolvedValue(null);

      const res = await request(app)
        .get('/suins/resolve/testuser');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /suins/reverse/:address', () => {
    it('returns resolved name', async () => {
      suinsService.reverseResolve.mockResolvedValue('testuser');

      const res = await request(app)
        .get('/suins/reverse/0xabc');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ address: '0xabc', name: 'testuser' });
    });

    it('returns 404 when not found', async () => {
      suinsService.reverseResolve.mockResolvedValue(null);

      const res = await request(app)
        .get('/suins/reverse/0xabc');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /suins/profile/:identifier', () => {
    it('returns profile for SuiNS name', async () => {
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
        .get('/suins/profile/testuser');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('owner', owner);
      expect(res.body).toHaveProperty('suinsName', 'testuser');
      expect(res.body.profile.displayName).toBe('Test User');
    });

    it('returns profile for SUI address and reverse resolves name', async () => {
      const owner = '0x1234567890abcdef1234567890abcdef12345678';
      suinsService.reverseResolve.mockResolvedValue('testuser');

      await profileRepository.upsertProfile(owner, {
        displayName: 'Test User',
        bio: 'Hello',
        socialLinks: [],
        metadata: {}
      }, 'testuser');

      const res = await request(app)
        .get(`/suins/profile/${owner}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('owner', owner);
      expect(res.body).toHaveProperty('suinsName', 'testuser');
    });
  });

  describe('POST /suins/register-intent', () => {
    it('returns 501 when not configured', async () => {
      const res = await request(app)
        .post('/suins/register-intent')
        .send({ name: 'testuser' });

      expect(res.status).toBe(501);
      expect(res.body).toHaveProperty('error');
    });

    it('returns registration url with referral', async () => {
      process.env.SUINS_REGISTRATION_URL = 'https://suins.example/register';
      process.env.SUINS_REFERRAL_CODE = 'dlux';
      process.env.SUINS_REFERRAL_PARAM = 'ref';

      const res = await request(app)
        .post('/suins/register-intent')
        .send({ name: 'testuser', suiAddress: '0xabc' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('registrationUrl');
      expect(res.body.registrationUrl).toContain('name=testuser');
      expect(res.body.registrationUrl).toContain('address=0xabc');
      expect(res.body.registrationUrl).toContain('ref=dlux');
    });
  });
});
