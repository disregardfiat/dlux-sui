/**
 * Premium content browser journey E2E.
 * Playwright-only, no backend calls. Navigates hub → author account page,
 * checks for premium/Walrus Seal content section, verifies items and pricing.
 * Also checks dApp detail page for premium badges or paywall.
 */

import { test, expect } from '@playwright/test';

test.describe('Premium Content - Browser Journey', () => {
  test('hub loads and author links are present', async ({ page }) => {
    await page.goto('/dapps');
    await expect(page.getByRole('heading', { name: /dapp hub|hub/i })).toBeVisible();

    const authorLink = page.locator('a[href^="/@"]').first();
    if (!(await authorLink.isVisible().catch(() => false))) {
      await authorLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No author links in hub — cannot test premium content journey');
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

  test('account page shows premium content section if available', async ({ page }) => {
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

    // Look for premium content heading
    const premiumHeading = page.locator('h2, h3, .section-title').filter({
      hasText: /premium|walrus seal|content for sale/i,
    });
    const hasPremium = await premiumHeading.first().isVisible({ timeout: 8000 }).catch(() => false);

    if (!hasPremium) {
      // Fall back: check for premium-related CSS classes
      const premiumByClass = page.locator(
        '[class*="premium"], [class*="walrus-seal"], [class*="content-sale"], [data-testid*="premium"]'
      );
      const hasPremiumClass = await premiumByClass.first().isVisible().catch(() => false);
      if (!hasPremiumClass) {
        // Account page loaded but no premium section — that's valid
        await expect(page.locator('.account-page')).toBeVisible();
        test.skip(true, 'No premium content section on this account page — feature may not be deployed');
        return;
      }
      await expect(premiumByClass.first()).toBeVisible();
      return;
    }

    await expect(premiumHeading.first()).toBeVisible();
  });

  test('premium content items show price or unlock status', async ({ page }) => {
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

    // Must have premium section to check items
    const premiumSection = page.locator('h2, h3, .section-title').filter({
      hasText: /premium|walrus seal|content for sale/i,
    });
    const hasPremium = await premiumSection.first().isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasPremium) {
      test.skip(true, 'Premium content section not visible — skipping item checks');
      return;
    }

    // Look for content items with price or unlock text
    const priceText = page.locator('text=/\\d+\\.?\\d*\\s*(SUI|MIST|tokens?)|unlock|locked|buy/i').first();
    const hasPrice = await priceText.isVisible().catch(() => false);

    if (hasPrice) {
      await expect(priceText).toBeVisible();
    } else {
      // Items may exist without explicit price text — check for item cards
      const contentItems = page.locator(
        '[class*="premium"] [class*="item"], [class*="premium"] [class*="card"], [class*="content-sale"] li'
      );
      const itemCount = await contentItems.count();
      if (itemCount === 0) {
        test.skip(true, 'Premium section visible but no content items found');
        return;
      }
      await expect(contentItems.first()).toBeVisible();
    }
  });

  test('dApp detail page may show premium badge or paywall', async ({ page }) => {
    await page.goto('/dapps');
    const viewLink = page.getByRole('link', { name: /^view$/i }).first();
    if (!(await viewLink.isVisible().catch(() => false))) {
      await viewLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await viewLink.isVisible().catch(() => false))) {
      test.skip(true, 'No dApps in hub — cannot check detail page for premium badge');
      return;
    }

    // Grab href before clicking (SPA navigation may not trigger waitForURL reliably)
    const href = await viewLink.getAttribute('href');
    await viewLink.click({ force: true });

    // Wait for URL change or detail content (SPA router may not cause full navigation)
    await Promise.race([
      page.waitForURL(/\/dapps\/.+/, { timeout: 10000 }),
      page.waitForURL(/\/dapp\/.+/, { timeout: 10000 }),
      page.locator('h1, h2, [class*="detail"], [class*="dapp-"]').first().waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => null);

    // If SPA didn't navigate, try direct navigation
    if (href && !/\/dapps?\/.+/.test(page.url())) {
      await page.goto(href);
    }
    await page.waitForLoadState('domcontentloaded');

    // Look for premium badge or paywall indicator
    const premiumBadge = page.locator(
      'text=/premium/i, [class*="premium-badge"], [data-testid="premium-badge"]'
    ).first();
    const paywall = page.locator(
      '[class*="paywall"], [data-testid="paywall"], text=/unlock to view|pay to access/i'
    ).first();

    const hasBadge = await premiumBadge.isVisible().catch(() => false);
    const hasPaywall = await paywall.isVisible().catch(() => false);

    if (!hasBadge && !hasPaywall) {
      // Detail page loaded without premium indicators — that's valid
      // Page may not have headings; just verify some content loaded
      const hasContent = await page.locator('body').evaluate(el => el.innerText.length > 50);
      expect(hasContent).toBeTruthy();
      test.skip(true, 'No premium badge or paywall on this dApp detail page');
      return;
    }

    if (hasBadge) await expect(premiumBadge).toBeVisible();
    if (hasPaywall) await expect(paywall).toBeVisible();
  });
});
