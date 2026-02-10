/**
 * Playwright-only wallet UX helpers (docs/testing-style.md).
 * All interaction via page.* / locator.*. No backend HTTP.
 *
 * For Slush: handles sign popup (click Sign, unlock wallet if locked).
 */

import type { Page } from '@playwright/test';
import { loadSlushPassword } from './slush-import';

const MODAL_TITLE = '.modal-title:has-text("Connect Sui Wallet")';
const CONSENT_CHECKBOX = '#privacy-consent';
const WALLET_BUTTON = '.modal-body .btn-outline-primary';

/**
 * Open the Connect Wallet modal by clicking the navbar button.
 * Waits for the page and button to be ready, then opens the modal.
 */
export async function openConnectWalletModal(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const connectBtn = page.getByRole('button', { name: /connect wallet/i });
  await connectBtn.waitFor({ state: 'visible', timeout: 25000 });
  await connectBtn.click();
  await page.locator(MODAL_TITLE).waitFor({ state: 'visible' });
}

/**
 * Check the privacy policy consent checkbox in the modal.
 */
export async function checkPrivacyConsent(page: Page): Promise<void> {
  await page.locator(CONSENT_CHECKBOX).check();
}

/**
 * Click a wallet in the list. Use name substrings (e.g. "Slush", "Sui Wallet").
 * If no name given, clicks the first available wallet button.
 */
export async function clickWallet(page: Page, name?: string): Promise<void> {
  const btn = name
    ? page.locator(WALLET_BUTTON).filter({ hasText: name })
    : page.locator(WALLET_BUTTON).first();
  await btn.click();
}

/**
 * Wait for the app to show a connected state (nav dropdown with "My Account" or similar).
 * Use after connect flow. Real wallet signing may take longer; timeout defaults to 20s.
 */
export async function waitForConnected(page: Page, timeoutMs = 20000): Promise<void> {
  await page
    .locator('a.nav-link.dropdown-toggle, [href*="/@"]')
    .first()
    .waitFor({ state: 'visible', timeout: timeoutMs });
}

/**
 * If account picker is shown (multiple accounts), select the first account.
 */
export async function handleAccountPickerIfShown(page: Page): Promise<void> {
  const picker = page.locator('.account-picker');
  if (await picker.isVisible().catch(() => false)) {
    const firstAccount = picker.locator('button.btn-outline-primary').first();
    await firstAccount.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Handle Slush extension sign popup: unlock wallet if locked, then click Sign.
 * Call with the extension popup page (from context.waitForEvent('page')).
 */
export async function handleSlushSignPopup(popup: Page): Promise<void> {
  await popup.bringToFront();
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForTimeout(2000);

  const password = loadSlushPassword();

  // Wait for unlock screen - password input can take a moment to render (React Native Web)
  const anyInput = popup.locator('input').first();
  const pwVisible = await anyInput.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false);

  if (pwVisible) {
    const pwInput = popup.locator('input[type="password"]').first();
    const target = (await pwInput.isVisible().catch(() => false)) ? pwInput : anyInput;
    await target.click({ force: true });
    // React Native Web / controlled inputs often need native events - try both strategies
    const filled = await popup.evaluate(({ pwd }: { pwd: string }) => {
      const el = document.querySelector('input[type="password"]') || document.querySelector('input');
      if (el && el instanceof HTMLInputElement) {
        el.focus();
        el.value = pwd;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }, { pwd: password }).catch(() => false);
    if (!filled) {
      await target.pressSequentially(password, { delay: 40 });
    }
    await popup.waitForTimeout(600);
    const unlockBtn = popup.locator('button').filter({ hasText: /unlock|continue|sign in|log in|submit|next|go/i });
    if (await unlockBtn.first().isVisible().catch(() => false)) {
      await unlockBtn.first().click({ force: true });
      await popup.waitForTimeout(2500);
    }
  }

  const signBtn = popup.locator('button').filter({ hasText: /sign|approve|confirm/i });
  await signBtn.first().waitFor({ state: 'visible', timeout: 10000 });
  await signBtn.first().click();
  await popup.waitForTimeout(1000);
}

/**
 * Wait for and handle a Slush sign popup after an action that triggers signing (e.g. like, post dapp).
 * Sets up the popup listener before running action, so the sign request is captured.
 */
export async function waitForAndHandleSlushSignPopup(
  page: Page,
  options?: { afterAction?: () => Promise<void>; timeoutMs?: number }
): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 25000;
  const context = page.context();
  const popupPromise = context.waitForEvent('page', { timeout: timeoutMs });
  if (options?.afterAction) {
    await options.afterAction();
  }
  try {
    const popup = await popupPromise;
    await handleSlushSignPopup(popup);
    return true;
  } catch {
    return false;
  }
}

/**
 * Full connect flow: open modal, optionally check consent, pick wallet, handle account picker if shown,
 * handle Slush sign popup (unlock + Sign), wait for connected.
 * Skips if no wallets are listed (e.g. no extension in E2E).
 * If already connected (account dropdown visible), returns true immediately.
 */
export async function connectWalletViaUI(
  page: Page,
  options: { consent?: boolean; walletName?: string } = {}
): Promise<boolean> {
  await page.waitForLoadState('domcontentloaded');
  const alreadyConnected = page.locator('a.nav-link.dropdown-toggle, [href*="/@"]').first();
  if (await alreadyConnected.isVisible().catch(() => false)) {
    return true;
  }
  await openConnectWalletModal(page);
  const empty = await page.locator('.empty-state:has-text("No Sui wallets detected")').isVisible();
  if (empty) return false;
  if (options.consent !== false) await checkPrivacyConsent(page);

  const context = page.context();
  const popupPromise = context.waitForEvent('page', { timeout: 25000 });

  await clickWallet(page, options.walletName);
  await page.waitForTimeout(1500);
  await handleAccountPickerIfShown(page);

  const popup = await popupPromise;
  await handleSlushSignPopup(popup);

  await waitForConnected(page, 30000);
  return true;
}
