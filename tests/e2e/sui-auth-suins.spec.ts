/**
 * E2E tests for SUI service auth (challenge, zk-login) and SuiNS (profile, availability).
 * Covers developer-guide API: POST /auth/challenge, POST /auth/zk-login, GET /suins/profile, GET /suins/availability.
 */

import { test, expect } from '@playwright/test';
import { apiClient } from './helpers/api-helpers';

// Valid SUI address format for tests
const validSuiAddress = () => '0x' + 'a'.repeat(64);

test.describe('SUI Auth API E2E', () => {
  test.beforeAll(async () => {
    const suiHealthy = await apiClient.checkHealth('sui');
    if (!suiHealthy) {
      test.skip(true, 'SUI service not available (SUI_SERVICE_URL)');
      return;
    }
  });

  test('POST /auth/challenge returns challengeId, challenge, expiresAt', async () => {
    const suiAddress = validSuiAddress();
    const result = await apiClient.getAuthChallenge(suiAddress);

    expect(result).toHaveProperty('challengeId');
    expect(result).toHaveProperty('challenge');
    expect(result).toHaveProperty('expiresAt');
    expect(typeof result.challengeId).toBe('string');
    expect(typeof result.challenge).toBe('string');
    expect(result.challengeId.length).toBeGreaterThan(0);
    expect(result.challenge.length).toBeGreaterThan(0);
  });

  test('POST /auth/challenge rejects missing suiAddress', async () => {
    try {
      await apiClient.sui.post('/auth/challenge', {});
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { response?: { status: number } };
      expect(e.response?.status).toBe(400);
    }
  });

  test('POST /auth/zk-login rejects missing required fields', async () => {
    try {
      await apiClient.zkLogin({
        suiAddress: validSuiAddress(),
        signature: '0x',
        challengeId: 'missing-challenge-id',
      });
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { response?: { status: number } };
      expect([400, 401]).toContain(e.response?.status);
    }
  });

  test('POST /auth/zk-login returns 401 for invalid or expired challenge', async () => {
    try {
      await apiClient.zkLogin({
        suiAddress: validSuiAddress(),
        signature: '0x' + 'b'.repeat(130),
        challengeId: '00000000-0000-0000-0000-000000000000',
      });
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { response?: { status: number } };
      expect(e.response?.status).toBe(401);
    }
  });
});

test.describe('SuiNS API E2E', () => {
  test.beforeAll(async () => {
    const suiHealthy = await apiClient.checkHealth('sui');
    if (!suiHealthy) {
      test.skip(true, 'SUI service not available (SUI_SERVICE_URL)');
      return;
    }
  });

  test('GET /suins/profile/:identifier returns 200 with object or 404', async () => {
    const address = validSuiAddress();
    try {
      const result = await apiClient.getSuinsProfile(address);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('suinsName');
      expect(result).toHaveProperty('profile');
    } catch (err: unknown) {
      const e = err as { response?: { status: number } };
      if (e.response?.status === 404) return;
      if ([500, 503].includes(e.response?.status ?? 0)) {
        test.skip(true, 'SuiNS resolver unavailable (5xx)');
        return;
      }
      throw err;
    }
  });

  test('GET /suins/profile/:identifier returns 200 with object or 404 (name)', async () => {
    try {
      const result = await apiClient.getSuinsProfile('testuser');
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('suinsName');
      expect(result).toHaveProperty('profile');
    } catch (err: unknown) {
      const e = err as { response?: { status: number } };
      expect(e.response?.status).toBe(404);
    }
  });

  test('GET /suins/availability/:name returns 200 or 503', async () => {
    try {
      const result = await apiClient.getSuinsAvailability('somename');
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('available');
      expect(typeof (result as { available?: boolean }).available).toBe('boolean');
    } catch (err: unknown) {
      const e = err as { response?: { status: number } };
      if (e.response?.status === 503) {
        expect(e.response.status).toBe(503);
      } else {
        throw err;
      }
    }
  });
});
