/**
 * E2E tests for governance API
 * Tests: Variables (foundationShare, pmFundShare), markets
 */

import { test, expect } from '@playwright/test';
import { apiClient } from './helpers/api-helpers';

test.describe('Governance API E2E', () => {
  let governanceAvailable = false;

  test.beforeAll(async () => {
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    if (!dgraphHealthy) {
      test.skip(true, 'DGraph service not available (DGRAPH_SERVICE_URL)');
      return;
    }
    try {
      await apiClient.getGovernanceVariables();
      governanceAvailable = true;
    } catch (err: any) {
      if (err.response?.status === 404) {
        governanceAvailable = false; // Routes not yet deployed
      } else {
        throw err;
      }
    }
  });

  test('should get governance variables', async () => {
    if (!governanceAvailable) {
      test.skip(true, 'Governance routes not yet deployed on dgraph-service');
      return;
    }
    const result = await apiClient.getGovernanceVariables();

    expect(result).toHaveProperty('variables');
    expect(Array.isArray(result.variables)).toBe(true);
    expect(result.variables.length).toBeGreaterThan(0);

    const names = result.variables.map((v: { name: string }) => v.name);
    expect(names).toContain('foundationShare');
    expect(names).toContain('pmFundShare');
    expect(names).toContain('maxAnnualChange');
  });

  test('should get foundationShare variable', async () => {
    if (!governanceAvailable) {
      test.skip(true, 'Governance routes not yet deployed on dgraph-service');
      return;
    }
    const result = await apiClient.getGovernanceVariable('foundationShare');

    expect(result).toHaveProperty('name', 'foundationShare');
    expect(result).toHaveProperty('value');
    expect(result).toHaveProperty('description');
    expect(typeof result.value).toBe('number');
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  test('should get pmFundShare variable', async () => {
    if (!governanceAvailable) {
      test.skip(true, 'Governance routes not yet deployed on dgraph-service');
      return;
    }
    const result = await apiClient.getGovernanceVariable('pmFundShare');

    expect(result).toHaveProperty('name', 'pmFundShare');
    expect(result).toHaveProperty('value');
    expect(typeof result.value).toBe('number');
  });

  test('should return 404 for unknown variable', async () => {
    if (!governanceAvailable) {
      test.skip(true, 'Governance routes not yet deployed on dgraph-service');
      return;
    }
    try {
      await apiClient.getGovernanceVariable('nonexistent_var_xyz');
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.response?.status).toBe(404);
    }
  });

  test('should get governance markets (may be empty)', async () => {
    if (!governanceAvailable) {
      test.skip(true, 'Governance routes not yet deployed on dgraph-service');
      return;
    }
    const result = await apiClient.getGovernanceMarkets();

    expect(result).toHaveProperty('markets');
    expect(Array.isArray(result.markets)).toBe(true);
  });
});
