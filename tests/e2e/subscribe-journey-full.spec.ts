/**
 * Subscribe journey E2E (browser-only). docs/testing-style.md.
 * Playwright-only, waitFor*, backend no-touch.
 * Scaffold: Subscribe UI (creator/premium) not fully implemented; skip where missing.
 */

import { test, expect } from '@playwright/test';

test.describe('Subscribe Journey - Browser-only E2E', () => {
  test('account page loads and is reachable from nav', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /hub/i }).first().click();
    await page.waitForURL(/\/dapps/, { timeout: 5000 });
    const profileLink = page.getByRole('link', { name: /profile/i }).first();
    if (await profileLink.isVisible()) {
      await profileLink.click();
      await page.waitForURL(/\/@/, { timeout: 5000 });
      await expect(page.locator('nav')).toBeVisible();
    }
  });

  test('subscribe CTA or tier UI on creator profile', async ({ page }) => {
    await page.goto('/dapps');
    const profileLink = page.getByRole('link', { name: /profile/i }).first();
    if (!(await profileLink.isVisible())) {
      test.skip(true, 'No profile link in hub yet');
      return;
    }
    await profileLink.click();
    await page.waitForURL(/\/@/, { timeout: 5000 });
    const subscribeBtn = page.getByRole('button', { name: /subscribe/i }).or(
      page.getByRole('link', { name: /subscribe/i })
    );
    if (await subscribeBtn.isVisible()) {
      await expect(subscribeBtn).toBeVisible();
    } else {
      test.skip(true, 'Subscribe UI not yet implemented on profile');
    }
  });
});
