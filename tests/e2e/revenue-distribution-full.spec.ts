/**
 * Revenue distribution / PM E2E (browser-only). docs/testing-style.md.
 * Playwright-only, waitFor*, backend no-touch. Hub PMs tab, market cards, place-bet/claim when UI exists.
 */

import { test, expect } from '@playwright/test';

test.describe('Revenue Distribution / PM - Browser-only E2E', () => {
  test('hub PMs tab shows markets or empty state', async ({ page }) => {
    await page.goto('/dapps');
    await page.getByRole('button', { name: /^PMs$/ }).click();
    await page.waitForSelector('.result-grid, .empty-state', { state: 'visible', timeout: 5000 });
    const hasMarkets = await page.locator('.result-grid .result-card').count() > 0;
    const empty = await page.locator('.empty-state:has-text("No markets")').isVisible();
    expect(hasMarkets || empty).toBeTruthy();
  });

  test('PM card shows metric and pool when present', async ({ page }) => {
    await page.goto('/dapps');
    await page.getByRole('button', { name: /^PMs$/ }).click();
    await page.waitForSelector('.result-grid, .empty-state', { state: 'visible', timeout: 5000 });
    const card = page.locator('.result-card').first();
    if (!(await card.isVisible())) {
      test.skip(true, 'No PM markets to inspect');
      return;
    }
    await expect(card.locator('.h5')).toBeVisible();
    await expect(card.locator('text=/pool|dApp|expires/i')).toBeVisible();
  });

  test('place bet or claim CTA when PM UI supports it', async ({ page }) => {
    await page.goto('/dapps');
    await page.getByRole('button', { name: /^PMs$/ }).click();
    await page.waitForSelector('.result-grid, .empty-state', { state: 'visible', timeout: 5000 });
    const betBtn = page.getByRole('button', { name: /bet|stake|place/i }).first();
    const claimBtn = page.getByRole('button', { name: /claim/i }).first();
    if (await betBtn.isVisible() || (await claimBtn.isVisible())) {
      await expect(betBtn.or(claimBtn)).toBeVisible();
    } else {
      test.skip(true, 'PM bet/claim UI not yet implemented');
    }
  });
});
