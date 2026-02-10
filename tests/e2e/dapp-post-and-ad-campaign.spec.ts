/**
 * E2E test: Post a simple hello world HTML dApp, view it, then create another dApp and turn it into an ad campaign.
 *
 * Prerequisites:
 * - Slush extension (npm run slush:download or SLUSH_EXTENSION_PATH)
 * - Wallet with testnet SUI for gas
 * - Services: SUI, DGraph, Walrus, Sandbox
 * - E2E_BASE_URL (e.g. http://localhost:3000 or https://test.dlux.io)
 *
 * Run: npm run test:e2e:slush (uses chromium-slush project)
 * Or: npx playwright test dapp-post-and-ad-campaign --project=chromium-slush
 */

import { test, expect } from './fixtures/slush-fixtures';
import { connectWalletViaUI, waitForAndHandleSlushSignPopup } from './helpers/wallet-ui-helpers';
import { apiClient, isDeployedDluxEnv } from './helpers/api-helpers';
import fs from 'fs';
import path from 'path';
import os from 'os';

test.describe.serial('dApp Post and Ad Campaign', () => {
  test.setTimeout(180000); // 3 minutes for remote testing

  let accountUrl: string;
  let advertiserAddress: string;
  let helloWorldDappId: string;
  let helloWorldDappName: string;
  let adCampaignDappId: string;
  let adCampaignDappName: string;
  let campaignId: string;

  test('1. Connect wallet and capture account URL', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const connected = await connectWalletViaUI(page, { consent: true, walletName: 'Slush' });
    expect(connected, 'Slush wallet must connect').toBe(true);

    // Wait for wallet connection to complete and account link to appear
    await page.waitForTimeout(2000); // Give time for wallet connection to process
    
    const toggleOrLink = page.locator('a.nav-link.dropdown-toggle, [href*="/@"]').first();
    await expect(toggleOrLink).toBeVisible({ timeout: 30000 });
    
    let href = await toggleOrLink.getAttribute('href');
    
    // If it's a dropdown toggle, click it to open the menu
    if (href === '#' || !href?.includes('/@')) {
      try {
        await toggleOrLink.click({ timeout: 15000 });
      } catch (e) {
        // If click fails, try force click
        await toggleOrLink.click({ force: true, timeout: 5000 });
      }
      await page.waitForTimeout(1000);
      const accountLink = page.locator('.dropdown-menu a[href*="/@"], .dropdown-item[href*="/@"]').first();
      await expect(accountLink).toBeVisible({ timeout: 15000 });
      href = await accountLink.getAttribute('href');
    }
    expect(href).toBeTruthy();
    expect(href).toMatch(/\/@/);
    accountUrl = href!.startsWith('http') ? new URL(href).pathname : href!;

    // Extract advertiser address from account URL (format: /@0x...)
    const match = accountUrl.match(/\/@(0x[a-fA-F0-9]+)/);
    expect(match).toBeTruthy();
    advertiserAddress = match![1];
  });

  test('2. Post a simple hello world HTML dApp', async ({ page }) => {
    // Capture network requests and console errors
    const networkFailures: string[] = [];
    const consoleErrors: string[] = [];
    const apiRequests: string[] = [];
    
    page.on('requestfailed', request => {
      networkFailures.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    page.on('request', request => {
      if (request.url().includes('/dapps') || request.url().includes('/walrus')) {
        apiRequests.push(`${request.method()} ${request.url()}`);
      }
    });
    
    await page.goto('/post');
    await expect(page.getByRole('heading', { name: /post a dapp/i })).toBeVisible({ timeout: 10000 });

    helloWorldDappName = `Hello World ${Date.now()}`;
    await page.getByPlaceholder('My Awesome dApp').fill(helloWorldDappName);
    await page.getByPlaceholder(/describe your dapp/i).fill('A simple hello world HTML dApp created for testing.');

    // Select Web App content type
    await page.locator('select').filter({ has: page.locator('option[value="webapp"]') }).selectOption('webapp');

    // Create a simple hello world HTML file as a temporary file
    const helloWorldHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 {
            font-size: 3rem;
            margin: 0;
        }
        p {
            font-size: 1.2rem;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Hello World!</h1>
        <p>This is a simple dApp posted via E2E test.</p>
    </div>
</body>
</html>`;

    // Create temporary file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `hello-world-${Date.now()}.html`);
    fs.writeFileSync(tempFile, helloWorldHtml, 'utf-8');

    try {
      // Upload the HTML file
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(tempFile);
      
      // Wait for file to be processed and appear in uploaded files list
      await page.waitForTimeout(1000);
      
      // Verify file was added to the uploaded files list
      // Use first() to handle strict mode violation (both .uploaded-files and .list-group exist)
      const uploadedFilesList = page.locator('.uploaded-files, .list-group').first();
      await expect(uploadedFilesList).toBeVisible({ timeout: 5000 });
      
      // Verify the file name appears in the list
      const fileNameInList = page.locator('.list-group-item').filter({ hasText: 'hello-world' }).or(page.locator('.list-group-item').filter({ hasText: '.html' })).first();
      await expect(fileNameInList).toBeVisible({ timeout: 5000 });
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Set minimum posting fee (1 SUI = 1,000,000,000 MIST)
    const feeInput = page.locator('input[placeholder*="default"], input[placeholder*="fee"], input[type="number"]').filter({ hasNot: page.locator('[disabled]') }).first();
    if (await feeInput.isVisible().catch(() => false)) {
      await feeInput.fill('0.001');
      await page.waitForTimeout(500); // Wait for validation
    }

    // Verify form is ready to submit (button should be enabled)
    const postBtn = page.getByRole('button', { name: /post dapp/i });
    await expect(postBtn).toBeEnabled({ timeout: 5000 });

    // Double-check that we have required fields filled
    const nameValue = await page.getByPlaceholder('My Awesome dApp').inputValue();
    const descValue = await page.getByPlaceholder(/describe your dapp/i).inputValue();
    expect(nameValue).toBeTruthy();
    expect(descValue).toBeTruthy();

    const signed = await waitForAndHandleSlushSignPopup(page, {
      afterAction: async () => {
        await postBtn.click();
      },
      timeoutMs: 60000 // Longer timeout for remote
    });

    if (!signed) {
      // Check if there's an error or if we need to retry
      await page.waitForTimeout(3000);
      
      const errorAlert = page.locator('.alert-danger');
      if (await errorAlert.isVisible().catch(() => false)) {
        const errorText = await errorAlert.textContent();
        const fullError = `Wallet signing failed or dApp posting failed: ${errorText}\nAPI requests: ${apiRequests.join('; ')}\nConsole errors: ${consoleErrors.join('; ')}\nNetwork failures: ${networkFailures.join('; ')}`;
        throw new Error(fullError);
      }
      
      // If no error alert but signing failed, check for network issues
      if (consoleErrors.length > 0 || networkFailures.length > 0) {
        throw new Error(`dApp posting failed. API requests: ${apiRequests.join('; ')}\nConsole errors: ${consoleErrors.join('; ')}\nNetwork failures: ${networkFailures.join('; ')}`);
      }
    }

    // Wait for redirect - frontend redirects to /dapps with query params, not account page
    // Also check for success message or error
    try {
      // Wait for either redirect or error message
      await Promise.race([
        page.waitForURL(/\/dapps/, { timeout: 60000 }),
        page.waitForSelector('.alert-danger, .alert-success', { timeout: 60000 })
      ]);
      
      const currentUrl = page.url();
      
      // Check for error first
      const errorAlert = page.locator('.alert-danger');
      if (await errorAlert.isVisible().catch(() => false)) {
        const errorText = await errorAlert.textContent();
        await page.screenshot({ path: 'test-results/dapp-post-error.png', fullPage: true });
        throw new Error(`dApp posting failed: ${errorText}`);
      }
      
      // If we're on /dapps, verify success
      if (currentUrl.match(/\/dapps/)) {
        expect(currentUrl).toMatch(/posted=1/);
        
        // Extract dApp ID from URL if present
        const urlParams = new URL(currentUrl).searchParams;
        const postedDappId = urlParams.get('dappId');
        
        // Verify the dApp actually exists by checking API
        if (postedDappId) {
          try {
            const dapp = await apiClient.getDapp(postedDappId);
            expect(dapp).toBeTruthy();
            expect(dapp.name).toBe(helloWorldDappName);
            helloWorldDappId = postedDappId;
          } catch (apiError: any) {
            await page.screenshot({ path: 'test-results/dapp-post-api-verify-failed.png', fullPage: true });
            throw new Error(`dApp was posted but not found in API: ${apiError.message}`);
          }
        } else {
          // No dappId in URL - try to find it by name
          await page.waitForTimeout(2000); // Give time for dApps to load
          const dapps = await apiClient.listDapps({ limit: 100 });
          const found = dapps.dapps?.find((d: any) => d.name === helloWorldDappName);
          if (found) {
            helloWorldDappId = found.id;
          } else {
            await page.screenshot({ path: 'test-results/dapp-post-not-found.png', fullPage: true });
            throw new Error(`dApp "${helloWorldDappName}" was not found after posting. Redirect happened but dApp doesn't exist.`);
          }
        }
      } else {
        // Still on /post page - check what happened
        await page.screenshot({ path: 'test-results/dapp-post-no-redirect.png', fullPage: true });
        throw new Error(`Expected redirect to /dapps but stayed on: ${currentUrl}`);
      }
    } catch (error: any) {
      // Check for error messages before failing
      const errorAlert = page.locator('.alert-danger');
      if (await errorAlert.isVisible().catch(() => false)) {
        const errorText = await errorAlert.textContent();
        await page.screenshot({ path: 'test-results/dapp-post-error.png', fullPage: true });
        throw new Error(`dApp posting failed: ${errorText}`);
      }
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/dapp-post-timeout.png', fullPage: true });
      throw error;
    }
  });

  test('3. View the hello world dApp in sandbox', async ({ page }) => {
    await page.goto(accountUrl);
    await expect(page.locator('.profile-header, .dapp-card')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Find and click the hello world dApp card
    const dappCard = page.locator('.dapp-card').filter({ hasText: helloWorldDappName });
    await dappCard.first().waitFor({ state: 'visible', timeout: 10000 });
    await dappCard.first().click();

    // Wait for sandbox to load (card navigates to h<hex>.walrus.dlux.io/@owner/permlink)
    await page.waitForURL(/walrus\.|:3007/, { timeout: 25000 });
    const sandboxUrl = page.url();
    expect(sandboxUrl).toMatch(/walrus\.|3007/);

    // Verify the hello world content is visible (may be behind ad overlay; overlay has Continue/Skip)
    const continueBtn = page.getByRole('button', { name: /continue|skip|accept/i });
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator('h1')).toContainText('Hello World', { timeout: 10000 });
    await expect(page.locator('body')).toContainText('simple dApp');
  });

  test('4. Verify hello world dApp exists and get ID', async ({ page }) => {
    // We should already have the dApp ID from test 2, but verify it exists
    expect(helloWorldDappId).toBeTruthy();
    
    // Verify via API
    const dapp = await apiClient.getDapp(helloWorldDappId);
    expect(dapp).toBeTruthy();
    expect(dapp.name).toBe(helloWorldDappName);
    expect(dapp.owner).toBe(advertiserAddress);
    
    // Also verify it appears on account page
    await page.goto(accountUrl);
    await expect(page.locator('.profile-header, .dapp-card')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Find the hello world dApp card
    const dappCard = page.locator('.dapp-card').filter({ hasText: helloWorldDappName });
    await expect(dappCard.first()).toBeVisible({ timeout: 10000 });
  });

  test('5. Create another dApp via API for ad campaign', async () => {
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    const suiHealthy = await apiClient.checkHealth('sui');
    const walrusHealthy = await apiClient.checkHealth('walrus');
    
    if (!dgraphHealthy || !suiHealthy || !walrusHealthy) {
      test.skip(true, 'Required services not available');
      return;
    }

    adCampaignDappName = `Ad Campaign dApp ${Date.now()}`;
    
    // Create a simple HTML for the ad campaign dApp
    const adDappHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ad Campaign dApp</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 {
            font-size: 3rem;
            margin: 0;
        }
        p {
            font-size: 1.2rem;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Ad Campaign dApp</h1>
        <p>This dApp will be promoted as an ad campaign.</p>
    </div>
</body>
</html>`;

    // Upload HTML to Walrus
    const blobResult = await apiClient.uploadBlob(
      Buffer.from(adDappHtml, 'utf-8'),
      'index.html',
      'text/html'
    );

    expect(blobResult).toHaveProperty('blobId');
    const blobId = blobResult.blobId;

    // Create dApp via API
    const dappResult = await apiClient.createDapp({
      name: adCampaignDappName,
      description: 'A dApp created for ad campaign testing',
      owner: advertiserAddress,
      blobIds: [blobId],
      manifest: {
        entryPoint: '/index.html',
        assets: [`/walrus/${blobId}`]
      },
      category: 'webapp',
      tags: ['test', 'ad-campaign'],
      postingFee: 1.0 // Minimum posting fee (1,000,000,000 MIST = 1 SUI)
    });

    expect(dappResult).toHaveProperty('id');
    adCampaignDappId = dappResult.id;
  });

  test('6. Create ad campaign for the second dApp', async () => {
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    if (!dgraphHealthy) {
      test.skip(true, 'DGraph service not available');
      return;
    }

    if (isDeployedDluxEnv()) {
      test.skip(true, 'Campaign creation requires write access (not available on deployed env)');
      return;
    }

    expect(adCampaignDappId).toBeTruthy();
    expect(advertiserAddress).toBeTruthy();

    // Get the dApp to construct its URL
    const dapp = await apiClient.getDapp(adCampaignDappId);
    expect(dapp).toBeTruthy();

    // Construct target URL (sandbox URL for the dApp)
    // Format: h{full_hex}.walrus.dlux.io/@{owner}/{permlink}
    // Use "h" + full hex of owner address (64 chars total: "h" + 63 hex chars for DNS-safe 64-char label)
    // Standard: "h" + public key in hex for full 64 char label to prevent collisions
    const normalizedAddr = advertiserAddress.toLowerCase().replace(/^0x/, '');
    const hexAddr = normalizedAddr.replace(/[^a-f0-9]/g, '').slice(0, 63); // Use 63 hex chars for 64-char label total (h + 63 hex)
    const subdomain = `h${hexAddr}`; // "h" + 63 hex = 64 chars total (DNS label limit is 63, but we use 64 for max uniqueness)
    const targetUrl = dapp.permlink 
      ? `https://${subdomain}.walrus.dlux.io/@${advertiserAddress}/${dapp.permlink}`
      : `https://example.com/dapp/${adCampaignDappId}`;

    // Create ad campaign
    // Note: Campaign creation via API requires JWT authentication.
    // In test environments, this may work if the repository uses in-memory mode.
    // In production/deployed environments, this will require proper authentication.
    const campaignData = {
      advertiser: advertiserAddress,
      title: `Campaign for ${adCampaignDappName}`,
      description: `Promoting ${adCampaignDappName} as an ad`,
      targetUrl: targetUrl,
      placements: ['gate', 'slip'],
      contentIds: [adCampaignDappId], // Link campaign to dApp
      bid: 0.01, // Cost per impression in SUI
      totalBudget: 1.0, // Total budget in SUI
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    };

    try {
      const campaign = await apiClient.createCampaign(campaignData);

      expect(campaign).toHaveProperty('id');
      expect(campaign.advertiser).toBe(advertiserAddress);
      expect(campaign.title).toBe(campaignData.title);
      expect(campaign.status).toBe('active');
      expect(campaign.contentIds).toContain(adCampaignDappId);
      expect(campaign.bid).toBe(campaignData.bid);
      expect(campaign.totalBudget).toBe(campaignData.totalBudget);

      campaignId = campaign.id;
    } catch (error: any) {
      // If campaign creation fails due to authentication, skip remaining campaign tests
      if (error.response?.status === 403 || error.response?.status === 401) {
        test.skip(true, 'Campaign creation requires authentication (JWT token). UI for campaign creation not yet implemented.');
        return;
      }
      throw error; // Re-throw if it's a different error
    }
  });

  test('7. Verify ad campaign is linked to dApp', async () => {
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    if (!dgraphHealthy) {
      test.skip(true, 'DGraph service not available');
      return;
    }

    if (!campaignId) {
      test.skip(true, 'Campaign was not created (likely due to authentication requirement)');
      return;
    }

    // Retrieve the campaign
    const campaign = await apiClient.getCampaign(campaignId);

    expect(campaign).toBeTruthy();
    expect(campaign.id).toBe(campaignId);
    expect(campaign.contentIds).toContain(adCampaignDappId);
    expect(campaign.status).toBe('active');

    // Verify the dApp exists
    const dapp = await apiClient.getDapp(adCampaignDappId);
    expect(dapp).toBeTruthy();
    expect(dapp.name).toBe(adCampaignDappName);
  });

  test('8. Verify ad can be selected for placement', async () => {
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    if (!dgraphHealthy) {
      test.skip(true, 'DGraph service not available');
      return;
    }

    if (!campaignId) {
      test.skip(true, 'Campaign was not created (likely due to authentication requirement)');
      return;
    }

    // Try to select ad for gate placement
    const adSelection = await apiClient.selectAd({
      placement: 'gate',
      contentId: adCampaignDappId
    });

    expect(adSelection).toHaveProperty('ad');
    // The ad may or may not be selected depending on auction logic, but the endpoint should work
    if (adSelection.ad) {
      expect(adSelection.ad).toHaveProperty('id');
      expect(adSelection.ad).toHaveProperty('title');
      expect(adSelection.ad).toHaveProperty('targetUrl');
    }
  });
});
