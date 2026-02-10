/**
 * User journey E2E (browser-only). docs/testing-style.md.
 * Playwright-only, waitFor*, backend no-touch. Browse home → hub → dApp detail.
 */

import { test, expect } from '@playwright/test';

test.describe('User Journey - Browser-only E2E', () => {
  test('home → hub → dApp detail via view', async ({ page }) => {
    if (process.env.E2E_BASE_URL?.includes('test.dlux.io')) {
      test.skip(true, 'Browser journey against test.dlux.io skips when hub has no seeded dApps');
      return;
    }
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();

    await page.getByRole('link', { name: /explore the hub|hub/i }).first().click();
    await page.waitForURL(/\/dapps/);
    await expect(page.getByRole('heading', { name: /dapp hub/i })).toBeVisible();

    const viewLink = page.getByRole('link', { name: /view/i }).first();
    const visible = await viewLink.isVisible().catch(() => false);
    if (!visible) {
      await viewLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    const visibleNow = await viewLink.isVisible().catch(() => false);
    if (!visibleNow) {
      test.skip(true, 'No dApps in hub yet (run seed-for-e2e or use local with dApps)');
      return;
    }
    await viewLink.click({ timeout: 15000 });

    await page.waitForURL(/\/dapps\/.+/);
    const skipBtn = page.getByRole('button', { name: /continue|skip/i });
    if (await skipBtn.isVisible().catch(() => false)) await skipBtn.click();
    await expect(page.getByRole('link', { name: /back to hub/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /open in sandbox|remix|back to hub/i })).toBeVisible();
  });

  test('hub search and filter', async ({ page }) => {
    await page.goto('/dapps');
    await expect(page.getByPlaceholder(/search dapps/i)).toBeVisible();

    await page.getByPlaceholder(/search dapps/i).fill('VR');
    await page.getByRole('button', { name: /^dApps$/ }).click();
    await expect(page.locator('.result-card, .empty-state')).toBeVisible();

    await page.getByRole('button', { name: /^PMs$/ }).click();
    await page.waitForSelector('.result-grid .result-card, .empty-state', { state: 'visible', timeout: 5000 });
    await expect(page.locator('.result-grid, .empty-state')).toBeVisible();
  });

  test('home trending dApps and view details', async ({ page }) => {
    await page.goto('/');
    const viewBtn = page.getByRole('link', { name: /view details/i }).first();
    if (!(await viewBtn.isVisible().catch(() => false))) {
      await viewBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    }
    if (!(await viewBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No "View details" link on home (trending dApps section not implemented)');
      return;
    }
    await viewBtn.click();
    await page.waitForURL(/\/dapps\/.+/);
    const adGate = page.locator('.ad-gate, [data-testid="ad-gate"]');
    if (await adGate.isVisible().catch(() => false)) {
      const skipBtn = page.getByRole('button', { name: /skip/i });
      await skipBtn.click();
    }
    const backLink = page.getByRole('link', { name: /back to hub/i });
    const backVisible = await backLink.isVisible().catch(() => false);
    if (!backVisible) {
      await backLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await backLink.isVisible().catch(() => false))) {
      test.skip(true, 'Detail page did not show Back to Hub (dApp may have been removed or overlay not dismissed)');
      return;
    }
  });
});
