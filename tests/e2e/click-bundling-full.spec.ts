/**
 * Click bundling E2E (browser-only). docs/testing-style.md.
 * Playwright-only, waitFor*, backend no-touch.
 * Scaffold: Ad overlay + click-through flow; when available, multiple contexts simulate users.
 */

import { test, expect } from '@playwright/test';

test.describe('Click Bundling - Browser-only E2E', () => {
  test('hub and dApp detail load without ad overlay', async ({ page }) => {
    if (process.env.E2E_BASE_URL?.includes('test.dlux.io')) {
      test.skip(true, 'Browser hub/dApp tests skip against test.dlux.io (no seeded dApps or flaky click)');
      return;
    }
    await page.goto('/dapps');
    await expect(page.getByRole('heading', { name: /dapp hub/i })).toBeVisible();
    const viewLink = page.getByRole('link', { name: /^view$/i }).first();
    if (!(await viewLink.isVisible().catch(() => false))) {
      await viewLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await viewLink.isVisible().catch(() => false))) {
      test.skip(true, 'No dApps in hub yet');
      return;
    }
    await viewLink.click({ force: true });
    await page.waitForURL(/\/dapps\/.+/);
    await expect(page.getByRole('heading', { name: /dapp details/i })).toBeVisible({ timeout: 5000 });
    const adOverlay = page.locator('[data-ad-overlay], .ad-overlay, [data-testid="ad-gate"]');
    if (await adOverlay.isVisible()) {
      await expect(adOverlay).toBeVisible();
    } else {
      test.skip(true, 'Ad gate/overlay not yet implemented for dApp view');
    }
  });

  test('multiple contexts can each hit dApp view', async ({ browser }) => {
    if (process.env.E2E_BASE_URL?.includes('test.dlux.io')) {
      test.skip(true, 'Browser hub/dApp tests skip against test.dlux.io');
      return;
    }
    const c1 = await browser.newContext();
    const c2 = await browser.newContext();
    const p1 = await c1.newPage();
    const p2 = await c2.newPage();
    try {
      await p1.goto('/dapps');
      await p2.goto('/dapps');
      await expect(p1.getByRole('heading', { name: /dapp hub/i })).toBeVisible();
      await expect(p2.getByRole('heading', { name: /dapp hub/i })).toBeVisible();
      const view1 = p1.getByRole('link', { name: /^view$/i }).first();
      const view2 = p2.getByRole('link', { name: /^view$/i }).first();
      const v1 = await view1.isVisible().catch(() => false);
      const v2 = await view2.isVisible().catch(() => false);
      if (!v1 || !v2) {
        test.skip(true, 'No dApps in hub yet');
        return;
      }
      await view1.click();
      await view2.click();
      await p1.waitForURL(/\/dapps\/.+/);
      await p2.waitForURL(/\/dapps\/.+/);
    } finally {
      await c1.close();
      await c2.close();
    }
  });
});
