/**
 * Playwright fixtures for E2E with Slush wallet extension.
 * Uses chromium with the extension loaded for real wallet login and signing.
 *
 * Requires: SLUSH_EXTENSION_PATH or run `npm run slush:download` first.
 * Requires: TEST_SLUSH_MNEMONIC (or tests/e2e/.env.slush) for automated wallet import.
 * Wallet is imported into the persistent profile on first run and persists across tests.
 */

import { test as base, chromium } from '@playwright/test';
import path from 'path';
import { existsSync } from 'fs';
import { ensureSlushWalletImported } from '../helpers/slush-import';

const SLUSH_EXTENSION_ID = 'opcgpfmipidbgpenhmajoajpbobppdil';

function getSlushExtensionPath(): string | null {
  const envPath = process.env.SLUSH_EXTENSION_PATH;
  if (envPath && existsSync(envPath)) return envPath;
  const withId = path.join(__dirname, '..', 'slush-extension', SLUSH_EXTENSION_ID);
  if (existsSync(withId)) return withId;
  const plain = path.join(__dirname, '..', 'slush-extension');
  if (existsSync(plain)) return plain;
  return null;
}

export const test = base.extend<{
  slushExtensionId: string;
}>({
  context: async ({}, use) => {
    const extPath = getSlushExtensionPath();
    if (!extPath) {
      throw new Error(
        'Slush extension not found. Run: npm run slush:download\n' +
        'Or set SLUSH_EXTENSION_PATH to the unpacked Slush extension directory.'
      );
    }
    const userDataDir = path.join(__dirname, '..', 'playwright-slush-profile');
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`,
      ],
    });

    // Ensure wallet is imported (persists in userDataDir; no-op if already done)
    try {
      const extId = await getExtensionId(context);
      await ensureSlushWalletImported(context, extId);
    } catch (err) {
      await context.close();
      throw err;
    }

    await use(context);
    await context.close();
  },

  slushExtensionId: async ({ context }, use) => {
    const id = await getExtensionId(context);
    await use(id);
  },
});

async function getExtensionId(context: import('@playwright/test').BrowserContext): Promise<string> {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    const page = await context.newPage();
    await page.goto(process.env.E2E_BASE_URL || 'https://test.dlux.io', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    }).catch(() => {});
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    await page.close().catch(() => {});
  }
  const url = serviceWorker.url();
  const id = url.split('/')[2];
  return id || SLUSH_EXTENSION_ID;
}

export const expect = test.expect;
