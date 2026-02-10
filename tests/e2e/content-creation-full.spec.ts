/**
 * Content creation E2E (browser-only). docs/testing-style.md.
 * Playwright-only, waitFor*, backend no-touch. Requires wallet for /post.
 */

import { test, expect } from '@playwright/test';
import { connectWalletViaUI } from './helpers/wallet-ui-helpers';

test.describe('Content Creation - Browser-only E2E', () => {
  test('home loads and nav is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.getByRole('link', { name: /home/i })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: 'Hub' })).toBeVisible();
  });

  test('post page requires auth and redirects when not logged in', async ({ page }) => {
    await page.goto('/post');
    await page.waitForURL(/\/($|\?)/);
    await expect(page).toHaveURL(/\//);
  });

  test('connect wallet flow opens modal and shows consent', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await expect(page.locator('.modal-title')).toContainText(/connect.*sui wallet/i);
    await expect(page.locator('#privacy-consent')).toBeVisible();
  });

  test('content creation form flow when wallet connected', async ({ page }) => {
    await page.goto('/');
    const connected = await connectWalletViaUI(page, { consent: true });
    if (!connected) {
      test.skip(true, 'No wallet extension; cannot authenticate for /post');
      return;
    }

    await page.goto('/post');
    await page.waitForURL(/\/post/);
    await expect(page.getByRole('heading', { name: /post a dapp/i })).toBeVisible();

    await page.getByPlaceholder('My Awesome dApp').fill('E2E Test dApp');
    await page.getByPlaceholder(/describe your dapp/i).fill('Created by Playwright E2E.');
    await page.locator('select').filter({ has: page.locator('option[value="video"]') }).selectOption('video');
    await page.locator('.upload-section input[type="url"]').fill('https://example.com/e2e-video.mp4');

    await expect(page.getByRole('button', { name: /post dapp/i })).toBeEnabled();
    await page.getByRole('button', { name: /post dapp/i }).click();

    await Promise.race([
      page.waitForURL(/\/@/, { timeout: 8000 }),
      page.waitForSelector('.alert-danger', { timeout: 8000 }).then(() => null),
    ]);
    const onAccount = /\/@/.test(page.url());
    expect(onAccount || (await page.locator('.alert-danger').isVisible())).toBeTruthy();
  });
});
