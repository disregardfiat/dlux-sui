import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests.
 * See https://playwright.dev/docs/test-configuration.
 *
 * Project style (docs/testing-style.md):
 * - Multiple user-agents: run same specs on Chromium, Firefox, WebKit.
 * - Bundled on testnet: E2E_BASE_URL + services point at testnet (or local validator). Never mainnet.
 * - Backend strictly no-touch: all interaction via Playwright (page.* / locator.*). No direct HTTP to services.
 * - Wait-for-callback: use waitForSelector, waitForResponse, expect(...).toBeVisible(), etc. No backend polling.
 *
 * Environment targets:
 * - Testnet:    E2E_BASE_URL=https://test.dlux.io  (default)
 * - Production: E2E_BASE_URL=https://dlux.io
 * - Local:      E2E_BASE_URL=http://localhost:3000
 *
 * See tests/e2e/env.testnet.example and tests/e2e/env.production.example for full config.
 * API helpers auto-detect test.dlux.io vs dlux.io and set SUI_SERVICE_URL, DGRAPH_SERVICE_URL, etc.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  /* Per-test timeout: 30s; global 15 min so full E2E run (100+ tests × 3 browsers) can complete. */
  timeout: 30000,
  globalTimeout: 900000,
  expect: { timeout: 5000 },
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. Must be bundled app; use testnet-backed services. */
    baseURL: process.env.E2E_BASE_URL || 'https://test.dlux.io',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Multiple user-agents: same E2E run on Chromium, Firefox, WebKit (docs/testing-style.md). */
  /* chromium-slush: real wallet E2E with Slush extension - run via test:e2e:slush */
  projects: [
    {
      name: 'chromium',
      testIgnore: /(wallet-login-real|full-journey-real|dapp-post-and-ad-campaign)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: /(wallet-login-real|full-journey-real|dapp-post-and-ad-campaign)\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: /(wallet-login-real|full-journey-real|dapp-post-and-ad-campaign)\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'chromium-slush',
      testMatch: /(wallet-login-real|full-journey-real|dapp-post-and-ad-campaign)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], headless: false, actionTimeout: 15000 },
      timeout: 60000,
      dependencies: [],
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
