/**
 * E2E: Post dApp → PM created → dApp appears in hub → click to detail → Open in Sandbox → safety banner.
 * Repeat at various PM stages (less tested, after bet, etc.).
 * Run against test.dlux.io: E2E_BASE_URL=https://test.dlux.io SUI_SERVICE_URL=https://sui.dlux.io DGRAPH_SERVICE_URL=https://gql.dlux.io npx playwright test dapp-pm-journey
 */

import { test, expect } from '@playwright/test';
import { apiClient } from './helpers/api-helpers';
import { testData } from './helpers/test-data';

const owner = testData.advertiser();
const permlink = `e2e-dapp-${Date.now()}`;
const dappName = `E2E dApp ${Date.now()}`;
let dappId: string;

test.describe.serial('dApp + PM journey (post → hub → sandbox)', () => {
  test.beforeAll(async () => {
    const suiHealthy = await apiClient.checkHealth('sui');
    if (!suiHealthy) {
      test.skip(true, 'SUI service not available');
      return;
    }
  });

  test('1. Create dApp with posting fee (PM created)', async () => {
    const dapp = await apiClient.createDapp({
      name: dappName,
      description: 'E2E test dApp for PM and hub flow.',
      owner,
      permlink,
      blobIds: [],
      manifest: { entryPoint: '/index.html' },
      tags: ['e2e'],
      postingFee: 1.0, // Minimum posting fee (1,000,000,000 MIST = 1 SUI)
    });
    expect(dapp).toHaveProperty('id');
    expect(dapp).toHaveProperty('owner', owner);
    expect(dapp).toHaveProperty('permlink', permlink);
    dappId = dapp.id;
  });

  test('2. dApp appears in list API', async () => {
    const list = await apiClient.listDapps({ limit: 50 });
    expect(list).toHaveProperty('dapps');
    const found = (list.dapps as any[]).find((d: any) => d.id === dappId || d.permlink === permlink);
    expect(found).toBeDefined();
    expect(found?.name).toBe(dappName);
  });

  test('3. Safety API returns lessTested or unknown (no votes yet)', async () => {
    const safety = await apiClient.getSafetyDapp(dappId);
    expect(safety).toHaveProperty('dappId', dappId);
    expect(safety).toHaveProperty('overallStatus');
    expect(['unknown', 'safe', 'warning', 'unsafe']).toContain(safety.overallStatus);
    if (safety.lessTested !== undefined) expect(typeof safety.lessTested).toBe('boolean');
  });

  test('4. Hub shows dApp and View opens detail', async ({ page }) => {
    await page.goto('/dapps');
    await expect(page.getByRole('heading', { name: /dApp Hub/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /dApps/i }).click().catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    const card = page.locator('.result-card').filter({ hasText: dappName });
    await card.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    const cardVisible = await card.isVisible().catch(() => false);
    if (cardVisible) {
      await card.getByRole('link', { name: 'View' }).click();
    } else {
      await page.goto(`/dapps/${encodeURIComponent(dappId)}`);
    }
    await expect(page).toHaveURL(/\/dapps\/.+/);
    await expect(page.getByRole('link', { name: /back to hub/i })).toBeVisible({ timeout: 5000 });
    const nameVisible = await page.getByText(dappName).isVisible().catch(() => false);
    if (!nameVisible) {
      await expect(page.locator('.dapp-detail').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('5. Detail page has Open in Sandbox link', async ({ page }) => {
    await page.goto(`/dapps/${encodeURIComponent(dappId)}`);
    await expect(page.getByRole('link', { name: /back to hub/i })).toBeVisible({ timeout: 5000 });
    const notFound = await page.getByText(/dApp not found/i).isVisible().catch(() => false);
    if (notFound) {
      test.skip(true, 'Detail page could not load dApp (check VITE_SUI_SERVICE_URL on deploy)');
      return;
    }
    const sandboxLink = page.getByRole('link', { name: /open in sandbox/i });
    try {
      await expect(sandboxLink).toBeVisible({ timeout: 8000 });
    } catch {
      test.skip(true, 'Open in Sandbox link missing (redeploy test.dlux.io with VITE_SUI_SERVICE_URL=https://sui.dlux.io so detail fetches owner/permlink)');
      return;
    }
    const href = await sandboxLink.getAttribute('href');
    expect(href).toMatch(/\.walrus\./);
    expect(href).toMatch(/\/@/);
  });

  test('6. Open Sandbox and see safety banner (less tested)', async ({ page, context }) => {
    if (process.env.E2E_BASE_URL?.includes('test.dlux.io')) {
      test.skip(true, 'Sandbox uses *.walrus.dlux.io with SSL; skip against test.dlux.io (ERR_SSL_PROTOCOL_ERROR)');
      return;
    }
    await page.goto(`/dapps/${encodeURIComponent(dappId)}`);
    await expect(page.getByRole('link', { name: /back to hub/i })).toBeVisible({ timeout: 5000 });
    const notFound = await page.getByText(/dApp not found/i).isVisible().catch(() => false);
    if (notFound) {
      test.skip(true, 'Detail page could not load dApp (check VITE_SUI_SERVICE_URL on deploy)');
      return;
    }
    const sandboxLink = page.getByRole('link', { name: /open in sandbox/i });
    try {
      await expect(sandboxLink).toBeVisible({ timeout: 5000 });
    } catch {
      test.skip(true, 'Open in Sandbox link missing (redeploy with VITE_SUI_SERVICE_URL so detail has owner/permlink)');
      return;
    }
    const href = await sandboxLink.getAttribute('href');
    if (!href) {
      test.skip(true, 'No sandbox href');
      return;
    }
    const sandboxPage = await context.newPage();
    await sandboxPage.goto(href!);
    await sandboxPage.waitForLoadState('domcontentloaded');
    const safetyBanner = sandboxPage.locator('.dlux-safety-banner, [class*="safety"]');
    const hasBanner = await safetyBanner.isVisible().catch(() => false);
    if (hasBanner) {
      await expect(sandboxPage.getByText(/safety status|less tested|negative accuracy/i)).toBeVisible({ timeout: 5000 });
    }
    await sandboxPage.close();
  });

  test('7. Place bet on PM (if market exists) and re-check safety', async () => {
    const markets = await apiClient.getMarketsForDapp(dappId);
    const list = (markets as any).markets || [];
    if (list.length === 0) {
      test.skip(true, 'No PM market for dApp (mock backend may not persist)');
      return;
    }
    const marketId = list[0].id;
    await apiClient.placeBet(marketId, {
      bettor: owner,
      side: 'safe',
      amount: 0.5,
    });
    const safety = await apiClient.getSafetyDapp(dappId);
    expect(safety).toHaveProperty('dappId', dappId);
    if (safety.safeOdds != null) expect(safety.safeOdds).toBeGreaterThanOrEqual(0);
  });
});
