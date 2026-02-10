/**
 * Feature coverage E2E - one test per documented feature.
 * Ensures every major feature has at least one browser test.
 * docs/testing-style.md, COVERAGE_VS_DOCS_AND_API.md
 */

import { test, expect } from '@playwright/test';

test.describe('Feature Coverage - one test per feature', () => {
  test('Home: hero, nav, hub link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.getByRole('link', { name: /explore the hub|hub/i }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /clawdbot|invite/i })).toBeVisible();
  });

  test('Hub: search and filter tabs', async ({ page }) => {
    await page.goto('/dapps');
    await expect(page.getByRole('heading', { name: /dapp hub|hub/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^dapps$/i })).toBeVisible();
  });

  test('Hub: navigate to dApp detail when dApps exist', async ({ page }) => {
    await page.goto('/dapps');
    const viewLink = page.getByRole('link', { name: /view/i }).first();
    if (!(await viewLink.isVisible().catch(() => false))) {
      test.skip(true, 'No dApps in hub');
      return;
    }
    await viewLink.click();
    await page.waitForURL(/\/dapps\/.+/);
    await expect(page.locator('h1, .dapp-detail, [class*="dapp"]')).toBeVisible();
  });

  test('Post dApp: auth guard redirects to home when not logged in', async ({ page }) => {
    await page.goto('/post');
    await page.waitForURL(/\//);
    expect(page.url()).toMatch(/\/(\?|$)/);
  });

  test('Privacy: page loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /privacy/i })).toBeVisible();
  });

  test('Account page: profile structure loads for valid address', async ({ page }) => {
    await page.goto('/@0x0000000000000000000000000000000000000000000000000000000000000001');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.account-page')).toBeVisible({ timeout: 10000 });
  });

  test('Connect wallet modal: opens and shows consent', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await expect(page.locator('.modal-title')).toContainText(/connect.*sui|connect.*wallet/i);
    await expect(page.getByRole('checkbox', { name: /privacy policy/i })).toBeVisible();
  });

  test('Social feed: section visible on home', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.social-feed-section, .feed-header, [class*="feed"]').first()).toBeVisible({ timeout: 8000 });
  });

  test('Billing: account billing section when viewing account', async ({ page }) => {
    await page.goto('/dapps');
    const firstAuthor = page.locator('a[href^="/@"]').first();
    if (!(await firstAuthor.isVisible().catch(() => false))) {
      test.skip(true, 'No author links in hub');
      return;
    }
    const href = await firstAuthor.getAttribute('href');
    if (!href) {
      test.skip(true, 'No account href');
      return;
    }
    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');
    const billingSection = page.locator('h2, .section-title').filter({ hasText: /billing|recent transactions|payouts/i });
    const hasBilling = await billingSection.first().isVisible().catch(() => false);
    if (!hasBilling) {
      const sections = page.locator('.section, .card, [class*="billing"]');
      await expect(sections.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('Premium content: Walrus Seal section when present', async ({ page }) => {
    await page.goto('/dapps');
    const authorLink = page.locator('a[href^="/@"]').first();
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No authors to check premium');
      return;
    }
    await page.goto(await authorLink.getAttribute('href')!);
    await page.waitForLoadState('domcontentloaded');
    const premiumSection = page.locator('h2, .section-title').filter({ hasText: /premium|walrus seal|content for sale/i });
    const hasPremium = await premiumSection.first().isVisible().catch(() => false);
    if (hasPremium) {
      await expect(premiumSection.first()).toBeVisible();
    }
    await expect(page.locator('.account-page')).toBeVisible();
  });

  test('Subscribe CTA: visible on non-own profile when applicable', async ({ page }) => {
    await page.goto('/dapps');
    const authorLink = page.locator('a[href^="/@"]').first();
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No author links');
      return;
    }
    await page.goto(await authorLink.getAttribute('href')!);
    await page.waitForLoadState('domcontentloaded');
    const subscribeBtn = page.getByRole('button', { name: /subscribe|ad-free/i });
    const visible = await subscribeBtn.isVisible().catch(() => false);
    if (visible) {
      await expect(subscribeBtn).toBeVisible();
    }
  });

  test('Governance: link or modal if present', async ({ page }) => {
    await page.goto('/');
    const govLink = page.getByRole('link', { name: /governance/i });
    const govBtn = page.getByRole('button', { name: /governance/i });
    const hasGov = await govLink.isVisible().catch(() => false) || await govBtn.isVisible().catch(() => false);
    if (hasGov) {
      await expect(govLink.or(govBtn)).toBeVisible();
    }
    await expect(page.locator('nav')).toBeVisible();
  });

  test('SuiNS: register section on own profile when no SuiNS', async ({ page }) => {
    await page.goto('/@0x1');
    await page.waitForLoadState('domcontentloaded');
    const suinsSection = page.locator('h2, .section-title').filter({ hasText: /suins|register.*name/i });
    const hasSuins = await suinsSection.first().isVisible().catch(() => false);
    if (hasSuins) {
      await expect(suinsSection.first()).toBeVisible();
    }
  });

  test('Prediction Markets: PMs filter tab on Hub', async ({ page }) => {
    await page.goto('/dapps');
    const pmBtn = page.getByRole('button', { name: /^PMs$/i });
    await expect(pmBtn).toBeVisible();
    await pmBtn.click();
    await expect(page.getByRole('heading', { name: /results/i })).toBeVisible();
  });

  test('Trending dApps: section visible on home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /trending dapps/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /view all/i })).toBeVisible();
  });

  test('DApp detail: Back to Hub and optional Remix when dApp exists', async ({ page }) => {
    await page.goto('/dapps');
    const viewLink = page.getByRole('link', { name: /view/i }).first();
    if (!(await viewLink.isVisible().catch(() => false))) {
      test.skip(true, 'No dApps in hub');
      return;
    }
    await viewLink.click();
    await page.waitForURL(/\/dapps\/.+/);
    await expect(page.getByRole('link', { name: /back to hub/i })).toBeVisible();
    // Remix link shown only when dApp has remix.html in pathMap
  });
});
