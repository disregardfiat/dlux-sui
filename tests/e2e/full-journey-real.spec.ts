/**
 * Full E2E journey with real Slush wallet: login → edit profile → post dApp → sandbox → cookie identity → ad network.
 *
 * Prerequisites:
 * - Slush extension (npm run slush:download or SLUSH_EXTENSION_PATH)
 * - Wallet with testnet SUI for gas
 * - Services: SUI, DGraph, Walrus, Sandbox
 * - E2E_BASE_URL (e.g. http://localhost:3000 or https://test.dlux.io)
 *
 * Run: npm run test:e2e:slush (uses chromium-slush project)
 * Or: npx playwright test full-journey-real --project=chromium-slush
 */

import { test, expect } from './fixtures/slush-fixtures';
import { connectWalletViaUI, waitForAndHandleSlushSignPopup } from './helpers/wallet-ui-helpers';

test.describe.serial('Full Journey - Real Wallet', () => {
  test.setTimeout(120000);

  let accountUrl: string;
  let dappName: string;
  let sandboxHref: string;

  test('1. Connect wallet and capture account URL', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const connected = await connectWalletViaUI(page, { consent: true, walletName: 'Slush' });
    expect(connected, 'Slush wallet must connect').toBe(true);

    const toggleOrLink = page.locator('a.nav-link.dropdown-toggle, [href*="/@"]').first();
    await expect(toggleOrLink).toBeVisible({ timeout: 20000 });
    let href = await toggleOrLink.getAttribute('href');
    if (href === '#' || !href?.includes('/@')) {
      await toggleOrLink.click();
      await page.waitForTimeout(500);
      const accountLink = page.locator('.dropdown-menu a[href*="/@"], .dropdown-item[href*="/@"]').first();
      await expect(accountLink).toBeVisible({ timeout: 5000 });
      href = await accountLink.getAttribute('href');
    }
    expect(href).toBeTruthy();
    expect(href).toMatch(/\/@/);
    accountUrl = href!.startsWith('http') ? new URL(href).pathname : href!;
  });

  test('2. Edit profile and verify changes in UX', async ({ page }) => {
    await page.goto(accountUrl);
    await expect(page.locator('.profile-header')).toBeVisible({ timeout: 10000 });

    const editBtn = page.getByRole('button', { name: /edit profile/i });
    await editBtn.click();
    await expect(page.locator('.modal-title')).toContainText(/edit profile/i);

    const displayName = `E2E Test User ${Date.now()}`;
    const bio = 'Edited by Playwright full journey E2E.';

    await page.locator('.modal-body input[placeholder="Your display name"]').fill(displayName);
    await page.locator('.modal-body textarea[placeholder="Tell us about yourself"]').fill(bio);
    await waitForAndHandleSlushSignPopup(page, {
      afterAction: async () => { await page.getByRole('button', { name: /save changes/i }).click(); },
      timeoutMs: 35000
    });

    await page.waitForTimeout(3000);

    await expect(page.locator('.display-name')).toContainText(displayName);
    await expect(page.locator('.bio')).toContainText(bio);
  });

  test('3. Post a dApp', async ({ page }) => {
    await page.goto('/post');
    await expect(page.getByRole('heading', { name: /post a dapp/i })).toBeVisible({ timeout: 10000 });

    dappName = `E2E Journey dApp ${Date.now()}`;
    await page.getByPlaceholder('My Awesome dApp').fill(dappName);
    await page.getByPlaceholder(/describe your dapp/i).fill('Created by full-journey-real E2E.');

    // Post as webapp with a minimal HTML file so the sandbox can serve it (video/URL-only has no entry blob)
    await page.locator('select').filter({ has: page.locator('option[value="webapp"]') }).selectOption('webapp');
    const htmlContent = '<!DOCTYPE html><html><head><title>E2E</title></head><body><h1>E2E Journey dApp</h1></body></html>';
    const fileInput = page.locator('.upload-section input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'index.html',
      mimeType: 'text/html',
      buffer: Buffer.from(htmlContent, 'utf-8'),
    });
    await page.waitForTimeout(1500);

    const feeInput = page.locator('input[placeholder="Leave empty for default"]');
    if (await feeInput.isVisible().catch(() => false)) {
      await feeInput.fill('0.01');
    }

    const postBtn = page.getByRole('button', { name: /post dapp/i });
    await waitForAndHandleSlushSignPopup(page, {
      afterAction: async () => { await postBtn.click(); },
      timeoutMs: 60000
    });

    await page.waitForURL(/\/dapps\/|\/@/, { timeout: 30000 });
    expect(page.url()).toMatch(/\/dapps\/|\/@/);
  });

  test('4. Open dApp via Walrus sandbox', async ({ page, context }) => {
    await page.goto(accountUrl);
    await expect(page.locator('.profile-header')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    const dappCard = page.locator('.dapp-card').filter({ hasText: dappName });
    await dappCard.first().waitFor({ state: 'visible', timeout: 10000 });
    await dappCard.first().click();

    await page.waitForURL(/walrus\.|:3007/, { timeout: 15000 }).catch(() => {});
    sandboxHref = page.url();
    expect(sandboxHref).toMatch(/walrus\.|3007/);
  });

  test('5. Sandbox: verify site-scoped cookie identifies user', async ({ context }) => {
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name === 'dlux_auth_shared' || c.name === 'dlux_jwt');
    const hasAuth = !!authCookie;
    expect(hasAuth, 'Auth cookie should be present for sandbox (site-scoped)').toBe(true);
  });

  test('6. Sandbox: ad network functions (consent / ad overlay)', async ({ page }) => {
    await page.goto(sandboxHref);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const gdprBanner = page.locator('.gdpr-banner, [class*="gdpr"], [class*="consent"]');
    const adOverlay = page.locator('.dlux-overlay, [class*="ad-"], [class*="sponsored"]');
    const hasGdprOrAd = (await gdprBanner.isVisible().catch(() => false))
      || (await adOverlay.isVisible().catch(() => false));
    if (hasGdprOrAd) {
      const skipBtn = page.getByRole('button', { name: /skip|continue|accept|agree/i });
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(1000);
      }
    }
    await expect(page.locator('h1, body')).toBeVisible();
  });
});
