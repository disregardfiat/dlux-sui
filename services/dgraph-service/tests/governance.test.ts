/**
 * Unit tests for governance API (platform variables).
 * Documents and validates the governance feature used by E2E (governance.spec.ts).
 */

import request from 'supertest';
import express from 'express';
import { governanceRouter } from '../src/routes/governance';

const app = express();
app.use(express.json());
app.use('/governance', governanceRouter);

describe('Governance API', () => {
  describe('GET /governance/variables', () => {
    it('returns all governance variables', async () => {
      const res = await request(app).get('/governance/variables');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('variables');
      expect(Array.isArray(res.body.variables)).toBe(true);
      expect(res.body.variables.length).toBeGreaterThan(0);
      const names = res.body.variables.map((v: { name: string }) => v.name);
      expect(names).toContain('foundationShare');
      expect(names).toContain('pmFundShare');
      expect(names).toContain('maxAnnualChange');
    });
  });

  describe('GET /governance/variables/:name', () => {
    it('returns foundationShare variable', async () => {
      const res = await request(app).get('/governance/variables/foundationShare');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'foundationShare');
      expect(res.body).toHaveProperty('value');
      expect(res.body).toHaveProperty('description');
      expect(typeof res.body.value).toBe('number');
      expect(res.body.value).toBeGreaterThanOrEqual(0);
      expect(res.body.value).toBeLessThanOrEqual(1);
    });

    it('returns pmFundShare variable', async () => {
      const res = await request(app).get('/governance/variables/pmFundShare');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('pmFundShare');
      expect(typeof res.body.value).toBe('number');
    });

    it('returns 404 for unknown variable', async () => {
      const res = await request(app).get('/governance/variables/nonexistent_var_xyz');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Variable not found');
    });
  });

  describe('GET /governance/markets', () => {
    it('returns markets array', async () => {
      const res = await request(app).get('/governance/markets');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('markets');
      expect(Array.isArray(res.body.markets)).toBe(true);
    });
  });

  describe('GET /governance/markets/active', () => {
    it('returns active markets array', async () => {
      const res = await request(app).get('/governance/markets/active');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('markets');
      expect(Array.isArray(res.body.markets)).toBe(true);
    });
  });
});
