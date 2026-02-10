/**
 * E2E tests for Walrus blob API: upload, get, info, billing.
 * Covers developer-guide: POST /blobs/upload, GET /blobs/:blobId, GET /blobs/:blobId/info, GET /blobs/:blobId/billing.
 */

import { test, expect } from '@playwright/test';
import { apiClient, isDeployedDluxEnv } from './helpers/api-helpers';

test.describe('Walrus Blobs API E2E', () => {
  let blobId: string;
  let uploadWorks = true;

  test.beforeAll(async () => {
    const walrusHealthy = await apiClient.checkHealth('walrus');
    if (!walrusHealthy) {
      test.skip(true, 'Walrus service not available (WALRUS_SERVICE_URL)');
      return;
    }
    if (isDeployedDluxEnv()) {
      uploadWorks = false;
    }
  });

  test('POST /blobs/upload returns blobId', async () => {
    if (!uploadWorks) {
      test.skip(true, 'Walrus blob upload returns 403/500 on deployed (network or write restricted)');
      return;
    }
    const body = Buffer.from('e2e blob content ' + Date.now(), 'utf8');
    const result = await apiClient.uploadBlob(body, 'e2e-test.txt', 'text/plain');

    expect(result).toHaveProperty('blobId');
    expect(typeof result.blobId).toBe('string');
    expect(result.blobId.length).toBeGreaterThan(0);
    blobId = result.blobId;
  });

  test('GET /blobs/:blobId returns blob bytes', async () => {
    if (!uploadWorks) {
      test.skip(true, 'Walrus blob upload returns 403/500 on deployed (network or write restricted)');
      return;
    }
    const body = Buffer.from('get-test ' + Date.now(), 'utf8');
    const upload = await apiClient.uploadBlob(body, 'get-test.txt', 'text/plain');
    const id = upload.blobId;

    const data = await apiClient.getBlob(id);
    expect(data).toBeDefined();
    const received = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    expect(received.toString('utf8')).toBe(body.toString('utf8'));
  });

  test('GET /blobs/:blobId/info returns metadata', async () => {
    if (!uploadWorks) {
      test.skip(true, 'Walrus blob upload returns 403/500 on deployed (network or write restricted)');
      return;
    }
    const body = Buffer.from('info-test', 'utf8');
    const upload = await apiClient.uploadBlob(body, 'info-test.txt', 'text/plain');
    const id = upload.blobId;

    const info = await apiClient.getBlobInfo(id);
    expect(info).toBeDefined();
    expect(info).toHaveProperty('blobId', id);
    expect(info).toHaveProperty('size');
    expect(info).toHaveProperty('contentType');
    expect(typeof (info as { size?: number }).size).toBe('number');
  });

  test('GET /blobs/:blobId/billing returns billing info', async () => {
    if (!uploadWorks) {
      test.skip(true, 'Walrus blob upload returns 403/500 on deployed (network or write restricted)');
      return;
    }
    const body = Buffer.from('billing-test', 'utf8');
    const upload = await apiClient.uploadBlob(body, 'billing-test.txt', 'text/plain');
    const id = upload.blobId;

    const billing = await apiClient.getBlobBilling(id);
    expect(billing).toBeDefined();
    expect(billing).toHaveProperty('blobId', id);
    expect(billing).toHaveProperty('termStart');
    expect(billing).toHaveProperty('precarious');
    expect(typeof (billing as { precarious?: boolean }).precarious).toBe('boolean');
  });
});
