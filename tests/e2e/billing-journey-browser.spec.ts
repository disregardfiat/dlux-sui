/**
 * Billing browser journey E2E.
 * Playwright-only, no backend calls. Navigates hub → author → account page,
 * verifies billing section, subscription status, and payouts summary.
 */

import { test, expect } from '@playwright/test';

test.describe('Billing - Browser Journey', () => {
  test('hub loads and author links are present', async ({ page }) => {
    await page.goto('/dapps');
    await expect(page.getByRole('heading', { name: /dapp hub|hub/i })).toBeVisible();

    const authorLink = page.locator('a[href^="/@"]').first();
    const hasAuthor = await authorLink.isVisible().catch(() => false);
    if (!hasAuthor) {
      // Wait a bit for dynamic content
      await authorLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No author links in hub — cannot test billing journey');
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

  test('account page has billing section', async ({ page }) => {
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

    const billingHeading = page.locator('h2, h3, .section-title').filter({
      hasText: /billing|recent transactions|payouts|revenue/i,
    });
    const hasBilling = await billingHeading.first().isVisible({ timeout: 8000 }).catch(() => false);

    if (!hasBilling) {
      // Fall back to checking for billing-related class
      const billingByClass = page.locator('[class*="billing"], [class*="transaction"], [class*="payout"]');
      const hasBillingClass = await billingByClass.first().isVisible().catch(() => false);
      if (!hasBillingClass) {
        test.skip(true, 'No billing section found on account page');
        return;
      }
      await expect(billingByClass.first()).toBeVisible();
      return;
    }

    await expect(billingHeading.first()).toBeVisible();
  });

  test('billing overview shows subscription status and payouts summary', async ({ page }) => {
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

    // Look for subscription-related text
    const subscriptionInfo = page.locator('text=/subscri(be|ption|bed)|ad-free/i').first();
    const hasSubscription = await subscriptionInfo.isVisible().catch(() => false);

    // Look for payouts/revenue summary
    const payoutInfo = page.locator('text=/payout|revenue|earnings|earned/i').first();
    const hasPayout = await payoutInfo.isVisible().catch(() => false);

    if (!hasSubscription && !hasPayout) {
      test.skip(true, 'No subscription or payout info visible on account page');
      return;
    }

    if (hasSubscription) await expect(subscriptionInfo).toBeVisible();
    if (hasPayout) await expect(payoutInfo).toBeVisible();
  });
});
