/**
 * Automated Slush wallet import for E2E tests.
 * Imports TEST_SLUSH_MNEMONIC into the Slush extension so tests can connect.
 * Uses TEST_SLUSH_PASSWORD for the wallet unlock/password step during import.
 *
 * Loads from tests/e2e/.env.slush or process.env.
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { BrowserContext } from '@playwright/test';

function loadMnemonic(): string | null {
  if (process.env.TEST_SLUSH_MNEMONIC?.trim()) return process.env.TEST_SLUSH_MNEMONIC.trim();
  const root = path.resolve(__dirname, '../../..');
  for (const p of ['tests/e2e/.env.slush', '.env.slush']) {
    const fp = path.join(root, p);
    if (existsSync(fp)) {
      const content = readFileSync(fp, 'utf8');
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*TEST_SLUSH_MNEMONIC\s*=\s*["']?([^"'\s#]+(?:\s+[^"'\s#]+)*)["']?\s*$/i);
        if (m) return m[1].trim();
      }
    }
  }
  return null;
}

export function loadSlushPassword(): string {
  if (process.env.TEST_SLUSH_PASSWORD?.trim()) return process.env.TEST_SLUSH_PASSWORD.trim();
  if (process.env.TestSlushPassword?.trim()) return process.env.TestSlushPassword.trim();
  const root = path.resolve(__dirname, '../../..');
  for (const p of ['tests/e2e/.env.slush', '.env.slush']) {
    const fp = path.join(root, p);
    if (existsSync(fp)) {
      const content = readFileSync(fp, 'utf8');
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*(?:TEST_SLUSH_PASSWORD|TestSlushPassword)\s*=\s*["']?([^"'\s#]+)["']?\s*$/i);
        if (m) return m[1].trim();
      }
    }
  }
  return 'test-password-123';
}

/**
 * Attempt to import the test wallet into Slush extension.
 * Call after launching persistent context. Uses same profile so import persists.
 *
 * @returns true if wallet is ready (already imported or import succeeded)
 * @throws if mnemonic missing or import fails
 */
export async function ensureSlushWalletImported(
  context: BrowserContext,
  extensionId: string,
  mnemonic: string | null = loadMnemonic()
): Promise<boolean> {
  if (!mnemonic) {
    throw new Error(
      'TEST_SLUSH_MNEMONIC not set. Create tests/e2e/.env.slush with the 12-word phrase, or run: npm run slush:setup'
    );
  }

  const extUrl = `chrome-extension://${extensionId}/index.html`;
  const setupPage = await context.newPage();

  try {
    await setupPage.goto(extUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await setupPage.waitForTimeout(3000); // Let React render

    // Check if we need to import (onboarding) vs wallet already exists
    const importBtn = setupPage.getByRole('button', { name: /import|recovery|existing wallet|have.*phrase/i });
    const createBtn = setupPage.getByRole('button', { name: /create|new wallet|get started/i });
    const hasImport = await importBtn.first().isVisible().catch(() => false);
    const hasCreate = await createBtn.first().isVisible().catch(() => false);

    if (!hasImport && !hasCreate) {
      // Maybe locked wallet - try unlock with password
      const passwordInput = setupPage.locator('input[type="password"]').first();
      if (await passwordInput.isVisible().catch(() => false)) {
        await passwordInput.fill(loadSlushPassword());
        const unlockBtn = setupPage.getByRole('button', { name: /unlock|continue|sign in|log in/i });
        if (await unlockBtn.first().isVisible().catch(() => false)) {
          await unlockBtn.first().click();
          await setupPage.waitForTimeout(2000);
        }
      }
      return true;
    }

    // Click Import (prefer) or Create -> look for import option
    if (hasImport) {
      await importBtn.first().click();
    } else if (hasCreate) {
      await createBtn.first().click();
      await setupPage.waitForTimeout(2000);
      const imp = setupPage.getByRole('button', { name: /import|recovery|phrase/i });
      if (await imp.first().isVisible().catch(() => false)) {
        await imp.first().click();
      }
    }
    await setupPage.waitForTimeout(2000);

    // Find mnemonic input - textarea or single input
    const phraseInput = setupPage.locator('textarea, input[type="text"]').first();
    await phraseInput.waitFor({ state: 'visible', timeout: 10000 });
    await phraseInput.fill(mnemonic);
    await setupPage.waitForTimeout(500);

    // Submit - Continue, Import, Next, etc.
    const submitBtn = setupPage.getByRole('button', { name: /continue|import|next|restore|confirm/i });
    if (await submitBtn.first().isVisible().catch(() => false)) {
      await submitBtn.first().click();
      await setupPage.waitForTimeout(3000);
    }

    // Password step (some wallets ask for password when importing)
    const passwordInput = setupPage.locator('input[type="password"]').first();
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill(loadSlushPassword());
      const pwdSubmit = setupPage.getByRole('button', { name: /continue|create|confirm|done/i });
      if (await pwdSubmit.first().isVisible().catch(() => false)) {
        await pwdSubmit.first().click();
        await setupPage.waitForTimeout(2000);
      }
    }

    // Skip any "Back up" or "Done" steps
    const doneBtn = setupPage.getByRole('button', { name: /done|finish|skip|got it/i });
    if (await doneBtn.first().isVisible().catch(() => false)) {
      await doneBtn.first().click();
      await setupPage.waitForTimeout(1000);
    }

    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Slush wallet import failed: ${msg}. Run "npm run slush:setup" manually to import the wallet, then re-run tests.`
    );
  } finally {
    await setupPage.close().catch(() => {});
  }
}
