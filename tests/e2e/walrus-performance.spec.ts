/**
 * E2E: Walrus upload/download performance verification.
 *
 * Covers:
 * - Blob upload returns within acceptable time
 * - Blob download serves from local cache (fast) vs Walrus network
 * - Blob info endpoint responds
 * - Multiple sequential reads are faster (cache hit)
 * - dApp manifest resolution doesn't block page load
 *
 * Run: E2E_BASE_URL=https://test.dlux.io npx playwright test walrus-performance
 */

import { test, expect } from '@playwright/test';
import { apiClient } from './helpers/api-helpers';

const UPLOAD_TIMEOUT_MS = 30000;  // 30s max for upload
const DOWNLOAD_TIMEOUT_MS = 15000; // 15s max for first download
const CACHED_TIMEOUT_MS = 3000;    // 3s max for cached download

let uploadedBlobId: string;

test.describe.serial('Walrus upload/download performance', () => {
  test.beforeAll(async () => {
    const walrusOk = await apiClient.checkHealth('walrus');
    test.skip(!walrusOk, 'Walrus service not available');
  });

  test('1. Upload blob completes within timeout', async () => {
    const testContent = Buffer.from(JSON.stringify({
      entryPoint: 'index.html',
      metadata: { title: 'Walrus perf test', author: 'e2e' },
      pathMap: { 'index.html': 'inline' }
    }));

    const start = Date.now();
    try {
      const result = await apiClient.uploadBlob(testContent, 'manifest.json', 'application/json');
      const elapsed = Date.now() - start;

      expect(result).toHaveProperty('blobId');
      uploadedBlobId = result.blobId;

      // Log timing for visibility
      console.log(`Upload completed in ${elapsed}ms`);
      expect(elapsed).toBeLessThan(UPLOAD_TIMEOUT_MS);
    } catch (e: any) {
      if (e?.response?.status === 500 && e?.response?.data?.error?.includes('not initialized')) {
        test.skip(true, 'Walrus client not connected (testnet may be unavailable)');
        return;
      }
      throw e;
    }
  });

  test('2. First download (may hit Walrus network)', async () => {
    if (!uploadedBlobId) {
      test.skip(true, 'No blob from upload step');
      return;
    }

    const start = Date.now();
    const data = await apiClient.getBlob(uploadedBlobId);
    const elapsed = Date.now() - start;

    expect(data).toBeTruthy();
    console.log(`First download completed in ${elapsed}ms`);
    expect(elapsed).toBeLessThan(DOWNLOAD_TIMEOUT_MS);
  });

  test('3. Second download (should be cached, much faster)', async () => {
    if (!uploadedBlobId) {
      test.skip(true, 'No blob from upload step');
      return;
    }

    const start = Date.now();
    const data = await apiClient.getBlob(uploadedBlobId);
    const elapsed = Date.now() - start;

    expect(data).toBeTruthy();
    console.log(`Cached download completed in ${elapsed}ms`);
    expect(elapsed).toBeLessThan(CACHED_TIMEOUT_MS);
  });

  test('4. Blob info endpoint responds', async () => {
    if (!uploadedBlobId) {
      test.skip(true, 'No blob from upload step');
      return;
    }

    const info = await apiClient.getBlobInfo(uploadedBlobId);
    expect(info).toHaveProperty('size');
    expect(info.size).toBeGreaterThan(0);
    if (info.contentType) {
      expect(info.contentType).toBe('application/json');
    }
  });

  test('5. Blob billing endpoint responds', async () => {
    if (!uploadedBlobId) {
      test.skip(true, 'No blob from upload step');
      return;
    }

    const billing = await apiClient.getBlobBilling(uploadedBlobId);
    expect(billing).toHaveProperty('blobId', uploadedBlobId);
    expect(billing).toHaveProperty('termLengthDays');
    expect(billing.termLengthDays).toBeGreaterThan(0);
  });

  test('6. dApp page loads within acceptable time (manifest resolution)', async ({ page }) => {
    // Navigate to dApps hub and measure load time
    const start = Date.now();
    await page.goto('/dapps');
    await page.waitForLoadState('domcontentloaded');

    const heading = page.getByRole('heading', { name: /dapp hub|hub/i });
    await heading.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
    const elapsed = Date.now() - start;

    console.log(`Hub page load: ${elapsed}ms`);
    // Hub should load within 15s even with Walrus manifest resolution
    expect(elapsed).toBeLessThan(15000);
  });

  test('7. dApp detail page loads within acceptable time', async ({ page }) => {
    // First get a dApp ID
    let dappId: string | null = null;
    try {
      const list = await apiClient.listDapps({ limit: 1 });
      if (list.dapps?.length > 0) {
        dappId = list.dapps[0].id;
      }
    } catch { /* ignore */ }

    if (!dappId) {
      test.skip(true, 'No dApps available for detail page test');
      return;
    }

    const start = Date.now();
    await page.goto(`/dapps/${encodeURIComponent(dappId)}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for detail content to appear
    await page.locator('.dapp-detail, h1, h2').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
    const elapsed = Date.now() - start;

    console.log(`Detail page load: ${elapsed}ms`);
    // Detail page should load within 15s even with Walrus manifest resolution
    expect(elapsed).toBeLessThan(15000);
  });
});
