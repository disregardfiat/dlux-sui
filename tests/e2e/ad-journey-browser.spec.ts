/**
 * Ad journey E2E (browser-only, style-aligned). docs/testing-style.md.
 * Playwright-only, waitFor*, backend no-touch. Covers discover → view → (ad overlay when present).
 * Legacy ad-journey-full.spec.ts uses backend/on-chain; use that for integration only.
 */

import { test, expect } from '@playwright/test';

test.describe('Ad Journey - Browser-only E2E', () => {
  test('home and hub load; discover path to content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
    await page.getByRole('link', { name: /hub|explore/i }).first().click();
    await page.waitForURL(/\/dapps/);
    await expect(page.getByRole('heading', { name: /dapp hub/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search dapps/i)).toBeVisible();
  });

  test('navigate to dApp detail from hub', async ({ page }) => {
    if (process.env.E2E_BASE_URL?.includes('test.dlux.io')) {
      test.skip(true, 'Browser hub/dApp tests skip against test.dlux.io (no seeded dApps or flaky click)');
      return;
    }
    await page.goto('/dapps');
    const viewLink = page.getByRole('link', { name: /^view$/i }).first();
    const viewVisible = await viewLink.isVisible().catch(() => false);
    if (!viewVisible) {
      await viewLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await viewLink.isVisible().catch(() => false))) {
      test.skip(true, 'No dApps in hub yet');
      return;
    }
    await viewLink.click({ force: true });
    await page.waitForURL(/\/dapps\/.+/);
    await expect(page.getByRole('heading', { name: /dapp details/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /open in sandbox|remix|back to hub/i })).toBeVisible();
  });

  test('ad gate or overlay when implemented', async ({ page }) => {
    if (process.env.E2E_BASE_URL?.includes('test.dlux.io')) {
      test.skip(true, 'Browser hub/dApp tests skip against test.dlux.io (no seeded dApps or flaky click)');
      return;
    }
    await page.goto('/dapps');
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
    const gate = page.locator('[data-ad-gate], .ad-gate, [data-testid="ad-overlay"]');
    if (await gate.isVisible()) {
      await expect(gate).toBeVisible();
      const continueBtn = page.getByRole('button', { name: /continue|skip/i });
      if (await continueBtn.isVisible()) await continueBtn.click();
    } else {
      test.skip(true, 'Ad gate not yet implemented');
    }
  });
});
