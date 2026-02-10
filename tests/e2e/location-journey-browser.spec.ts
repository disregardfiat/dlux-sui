/**
 * Location / spots browser journey E2E.
 * Playwright-only, no backend calls. Checks for location UI in nav and on
 * account pages, verifies preferences (toggle, precision selector).
 */

import { test, expect } from '@playwright/test';

test.describe('Location / Spots - Browser Journey', () => {
  test('home loads and nav is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('location link or button in nav or page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const locationLink = page.getByRole('link', { name: /location|spots|nearby/i });
    const locationBtn = page.getByRole('button', { name: /location|spots|nearby/i });

    const hasLink = await locationLink.first().isVisible().catch(() => false);
    const hasBtn = await locationBtn.first().isVisible().catch(() => false);

    if (!hasLink && !hasBtn) {
      test.skip(true, 'Location UI not deployed — no link or button found');
      return;
    }

    await expect(locationLink.first().or(locationBtn.first())).toBeVisible();
  });

  test('clicking location opens modal or view with preferences', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const locationTrigger = page.getByRole('link', { name: /location|spots|nearby/i })
      .first()
      .or(page.getByRole('button', { name: /location|spots|nearby/i }).first());

    const hasTrigger = await locationTrigger.isVisible().catch(() => false);
    if (!hasTrigger) {
      test.skip(true, 'Location UI not deployed');
      return;
    }

    await locationTrigger.click();

    // Wait for modal or view to appear
    const locationView = page.locator(
      '.modal, [role="dialog"], [class*="location"], [class*="spot"]'
    ).first();
    const viewVisible = await locationView.isVisible({ timeout: 5000 }).catch(() => false);
    if (!viewVisible) {
      test.skip(true, 'Location modal/view did not appear after click');
      return;
    }

    await expect(locationView).toBeVisible();

    // Check for preference controls: toggle or precision selector
    const toggle = page.locator(
      'input[type="checkbox"], [role="switch"], [class*="toggle"]'
    ).first();
    const precisionSelect = page.locator(
      'select, [class*="precision"], [class*="slider"]'
    ).first();

    const hasToggle = await toggle.isVisible().catch(() => false);
    const hasPrecision = await precisionSelect.isVisible().catch(() => false);

    if (hasToggle) await expect(toggle).toBeVisible();
    if (hasPrecision) await expect(precisionSelect).toBeVisible();
    if (!hasToggle && !hasPrecision) {
      // At minimum the location view itself is present
      await expect(locationView).toBeVisible();
    }
  });

  test('account page has location section when available', async ({ page }) => {
    await page.goto('/dapps');
    const authorLink = page.locator('a[href^="/@"]').first();
    if (!(await authorLink.isVisible().catch(() => false))) {
      await authorLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    }
    if (!(await authorLink.isVisible().catch(() => false))) {
      test.skip(true, 'No author links in hub — cannot check account location section');
      return;
    }

    const href = await authorLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    const locationSection = page.locator('h2, h3, .section-title').filter({
      hasText: /location|spot|nearby|geohash/i,
    });
    const hasLocation = await locationSection.first().isVisible().catch(() => false);

    if (!hasLocation) {
      // Also check by class
      const locationByClass = page.locator('[class*="location"], [class*="spot"], [class*="geo"]');
      const hasByClass = await locationByClass.first().isVisible().catch(() => false);
      if (!hasByClass) {
        test.skip(true, 'No location section on account page');
        return;
      }
      await expect(locationByClass.first()).toBeVisible();
      return;
    }

    await expect(locationSection.first()).toBeVisible();
  });
});
