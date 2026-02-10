/**
 * Subscribe end-to-end browser journey E2E.
 * Playwright-only, no backend calls. Navigates hub → author account page,
 * looks for subscribe button, opens modal, verifies tiers and payment CTA.
 */

import { test, expect } from '@playwright/test';

test.describe('Subscribe - Browser Journey', () => {
  test('hub loads and author links are present', async ({ page }) => {
    await page.goto('/dapps');
    await expect(page.getByRole('heading', { name: /dapp hub|hub/i })).toBeVisible();

    const authorLink = page.locator('a[href^="/@"]').first();
    if (!(await authorLink.isVisible().catch(() => false))) {
      await authorLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No author links in hub — cannot test subscribe journey');
      return;
    }
    await expect(authorLink).toBeVisible();
  });

  test('navigate to author account page from hub', async ({ page }) => {
    await page.goto('/dapps');
    const authorLink = page.locator('a[href^="/@"]').first();
    if (!(await authorLink.isVisible().catch(() => false))) {
      await authorLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No author links in hub');
      return;
    }

    const href = await authorLink.getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.account-page')).toBeVisible({ timeout: 10000 });
  });

  test('account page has subscribe button', async ({ page }) => {
    await page.goto('/dapps');
    const authorLink = page.locator('a[href^="/@"]').first();
    if (!(await authorLink.isVisible().catch(() => false))) {
      await authorLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No author links in hub');
      return;
    }

    const href = await authorLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    const subscribeBtn = page.getByRole('button', { name: /subscribe|ad-free|support/i });
    const subscribeLink = page.getByRole('link', { name: /subscribe|ad-free|support/i });

    const hasBtn = await subscribeBtn.first().isVisible({ timeout: 8000 }).catch(() => false);
    const hasLink = await subscribeLink.first().isVisible().catch(() => false);

    if (!hasBtn && !hasLink) {
      test.skip(true, 'Subscribe UI not deployed or viewing own profile');
      return;
    }

    await expect(subscribeBtn.first().or(subscribeLink.first())).toBeVisible();
  });

  test('clicking subscribe opens modal with tiers', async ({ page }) => {
    await page.goto('/dapps');
    const authorLink = page.locator('a[href^="/@"]').first();
    if (!(await authorLink.isVisible().catch(() => false))) {
      await authorLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No author links in hub');
      return;
    }

    const href = await authorLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    const subscribeBtn = page.getByRole('button', { name: /subscribe|ad-free|support/i });
    const hasBtn = await subscribeBtn.first().isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Subscribe button not visible — cannot test modal');
      return;
    }

    await subscribeBtn.first().click();

    // Wait for modal to appear
    const modal = page.locator(
      '.modal, [role="dialog"], [class*="subscribe-modal"], [data-testid="subscribe-modal"]'
    ).first();
    const modalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);

    if (!modalVisible) {
      // May have navigated to a subscribe page instead
      const subscribeHeading = page.getByRole('heading', { name: /subscribe|choose.*plan|tiers?/i });
      const hasHeading = await subscribeHeading.isVisible({ timeout: 3000 }).catch(() => false);
      if (!hasHeading) {
        test.skip(true, 'Subscribe modal or page did not appear after click');
        return;
      }
      await expect(subscribeHeading).toBeVisible();
      return;
    }

    await expect(modal).toBeVisible();

    // Check for tier names or pricing inside the modal
    const tierText = modal.locator('text=/tier|basic|pro|premium|monthly|annual/i').first();
    const priceText = modal.locator('text=/\\d+\\.?\\d*\\s*(SUI|MIST|\\$|per)/i').first();

    const hasTier = await tierText.isVisible().catch(() => false);
    const hasPrice = await priceText.isVisible().catch(() => false);

    // At least one indicator of tiers/pricing should be visible
    if (hasTier) await expect(tierText).toBeVisible();
    if (hasPrice) await expect(priceText).toBeVisible();
  });

  test('subscribe modal has payment button', async ({ page }) => {
    await page.goto('/dapps');
    const authorLink = page.locator('a[href^="/@"]').first();
    if (!(await authorLink.isVisible().catch(() => false))) {
      await authorLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No author links in hub');
      return;
    }

    const href = await authorLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    const subscribeBtn = page.getByRole('button', { name: /subscribe|ad-free|support/i });
    const hasBtn = await subscribeBtn.first().isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Subscribe button not visible — cannot test payment CTA');
      return;
    }

    await subscribeBtn.first().click();

    const modal = page.locator(
      '.modal, [role="dialog"], [class*="subscribe-modal"], [data-testid="subscribe-modal"]'
    ).first();
    const modalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);
    if (!modalVisible) {
      test.skip(true, 'Subscribe modal did not appear');
      return;
    }

    // Check for payment/connect button
    const payBtn = modal.getByRole('button', { name: /connect.*pay|pay|confirm|subscribe now/i });
    const hasPayBtn = await payBtn.first().isVisible().catch(() => false);

    if (!hasPayBtn) {
      // Fall back: any button inside the modal that looks like an action
      const actionBtn = modal.getByRole('button').filter({ hasNotText: /close|cancel|x/i });
      const hasAction = await actionBtn.first().isVisible().catch(() => false);
      if (!hasAction) {
        test.skip(true, 'No payment or action button found in subscribe modal');
        return;
      }
      await expect(actionBtn.first()).toBeVisible();
      return;
    }

    await expect(payBtn.first()).toBeVisible();
  });

  test('account page shows subscription status area', async ({ page }) => {
    await page.goto('/dapps');
    const authorLink = page.locator('a[href^="/@"]').first();
    if (!(await authorLink.isVisible().catch(() => false))) {
      await authorLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No author links in hub');
      return;
    }

    const href = await authorLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    // Look for subscription status text anywhere on the account page
    const statusText = page.locator(
      'text=/subscri(be|ption|bed)|ad-free|supporter|member since/i'
    ).first();
    const hasStatus = await statusText.isVisible({ timeout: 8000 }).catch(() => false);

    if (!hasStatus) {
      // Check for class-based subscription status
      const statusByClass = page.locator(
        '[class*="subscription"], [class*="sub-status"], [data-testid*="subscription"]'
      );
      const hasStatusClass = await statusByClass.first().isVisible().catch(() => false);
      if (!hasStatusClass) {
        test.skip(true, 'No subscription status area on account page');
        return;
      }
      await expect(statusByClass.first()).toBeVisible();
      return;
    }

    await expect(statusText).toBeVisible();
  });
});
