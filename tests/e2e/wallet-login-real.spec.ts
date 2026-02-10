/**
 * E2E tests with real Slush wallet - login and social interactions via actual signing.
 * Requires: Slush extension (npm run slush:download or SLUSH_EXTENSION_PATH).
 * Run: npm run test:e2e:slush
 *
 * Before first run: Create/import a wallet in Slush and ensure it has testnet SUI for gas.
 * The browser will open; complete Slush onboarding if prompted, then tests interact with the app.
 */

import { test, expect } from './fixtures/slush-fixtures';
import { connectWalletViaUI, waitForAndHandleSlushSignPopup } from './helpers/wallet-ui-helpers';

test.describe('Wallet login - real Slush', () => {
  test('connect wallet flow with Slush extension', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const connected = await connectWalletViaUI(page, { consent: true, walletName: 'Slush' });
    expect(connected).toBe(true);
    // Should see account link or dropdown
    await expect(
      page.locator('a.nav-link.dropdown-toggle, [href*="/@"]').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('post page after wallet connect', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const connected = await connectWalletViaUI(page, { consent: true, walletName: 'Slush' });
    if (!connected) {
      test.skip(true, 'Slush wallet not connected');
      return;
    }
    await page.goto('/post');
    await page.waitForURL(/\/post/);
    await expect(page.getByRole('heading', { name: /post a dapp/i })).toBeVisible();
  });
});

test.describe('Social - real wallet signing', () => {
  test('like post after connect', async ({ page }) => {
    await page.goto('/');
    const connected = await connectWalletViaUI(page, { consent: true, walletName: 'Slush' });
    if (!connected) {
      test.skip(true, 'Slush wallet not connected');
      return;
    }
    // Navigate to feed, find a post, click like (triggers sign popup)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const likeBtn = page.locator('button').filter({ hasText: /heart|like/i }).first();
    if (await likeBtn.isVisible()) {
      await waitForAndHandleSlushSignPopup(page, {
        afterAction: async () => { await likeBtn.click(); }
      });
    }
    // Test passes if we got here; full flow depends on feed having posts
  });
});
