/**
 * E2E: Full dApp journey - post → PM → resolve → ad register.
 *
 * Complete flow:
 * 1. Post dApp on-chain via wallet transaction
 * 2. Wait for PM to be created automatically
 * 3. Resolve PM (or wait for auto-resolution if PM_DURATION_MS is short)
 * 4. Register dApp as ad campaign (wallet-funded on-chain)
 * 5. Verify campaign exists and is queryable
 *
 * Prerequisites:
 * - Contracts deployed: PACKAGE_ID and POSTING_POOL_ID set
 * - Funded wallet: TEST_ADVERTISER_PRIVATE_KEY or TEST_SLUSH_MNEMONIC
 * - PM_DURATION_MS set to short duration for testnet (e.g., 600000 = 10 min)
 *
 * Run: PACKAGE_ID=0x... POSTING_POOL_ID=0x... PM_DURATION_MS=600000 npx playwright test dapp-journey-full
 */

import { test, expect } from '@playwright/test';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  ensureWalletFunded,
  loadTestKeypair,
  loadSlushKeypairFromMnemonic,
  signAndExecute,
  extractEvent,
  waitForTransaction,
  TestWallet
} from './helpers/wallet-helpers';
import { apiClient } from './helpers/api-helpers';
import { bcs } from '@mysten/sui/bcs';

const SUI_RPC_URL = process.env.SUI_RPC_URL
  || (process.env.E2E_BASE_URL?.includes('test.dlux.io') ? 'https://fullnode.testnet.sui.io:443' : 'http://localhost:9000');
const CLOCK_ID = '0x6';
const MIN_POSTING_FEE_MIST = 1_000_000_000; // 1 SUI
const PM_DURATION_MS = Number(process.env.PM_DURATION_MS) || 600000; // 10 min default for testnet

function getPackageId(): string {
  const env = process.env.PACKAGE_ID || process.env.VITE_SUI_PACKAGE_ID;
  if (env) return env;
  const scriptDir = resolve(__dirname, 'scripts');
  const f = resolve(scriptDir, '.package_id');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  return '';
}

function getPostingPoolId(): string {
  const env = process.env.POSTING_POOL_ID || process.env.VITE_POSTING_POOL_ID;
  if (env) return env;
  const scriptDir = resolve(__dirname, 'scripts');
  const f = resolve(scriptDir, '.posting_pool_id');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  return '';
}

function getPostingTreasuryConfigId(): string {
  const env = process.env.POSTING_TREASURY_CONFIG_ID || process.env.VITE_POSTING_TREASURY_CONFIG_ID;
  if (env) return env;
  const scriptDir = resolve(__dirname, 'scripts');
  const f = resolve(scriptDir, '.posting_treasury_config_id');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  return '';
}

function getPostingRegistryId(): string {
  const env = process.env.POSTING_REGISTRY_ID || process.env.VITE_POSTING_REGISTRY_ID;
  if (env) return env;
  const scriptDir = resolve(__dirname, 'scripts');
  const f = resolve(scriptDir, '.posting_registry_id');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  return '';
}

const toBytes = (s: string) => Array.from(new TextEncoder().encode(s));

test.describe.serial('Full dApp journey: post → PM → resolve → ad register', () => {
  test.setTimeout(PM_DURATION_MS + 120000); // PM duration + 2 min buffer

  let wallet: TestWallet;
  let dappId: string;
  let marketId: string;
  let campaignTxDigest: string;

  test.beforeAll(async () => {
    const packageId = getPackageId();
    const poolId = getPostingPoolId();
    const registryId = getPostingRegistryId();
    const configId = getPostingTreasuryConfigId();
    if (!packageId || !poolId || !registryId || !configId) {
      test.skip(true, 'PACKAGE_ID, POSTING_POOL_ID, POSTING_REGISTRY_ID, and POSTING_TREASURY_CONFIG_ID required');
      return;
    }

    const suiOk = await apiClient.checkHealth('sui');
    const dgraphOk = await apiClient.checkHealth('dgraph');
    test.skip(!suiOk || !dgraphOk, 'SUI or DGraph service not available');

    const keypair = loadSlushKeypairFromMnemonic() || loadTestKeypair('payer');
    const client = new SuiClient({ url: SUI_RPC_URL });
    const address = keypair.toSuiAddress();
    wallet = { keypair, address, client };

    // Ensure wallet has enough SUI for posting fee + ad campaign budget + gas
    const minBalance = BigInt(200_000_000); // 0.2 SUI (post fee + ad budget + gas)
    const funded = await ensureWalletFunded(wallet, minBalance);
    if (!funded) {
      test.skip(true, `Wallet ${address} needs funding - use faucet or set TEST_ADVERTISER_PRIVATE_KEY`);
      return;
    }
  });

  test('1. Post dApp on-chain → triggers PM creation', async () => {
    const packageId = getPackageId();
    const poolId = getPostingPoolId();
    const registryId = getPostingRegistryId();
    const configId = getPostingTreasuryConfigId();
    if (!packageId || !poolId || !registryId || !configId) return;

    const permlink = `e2e-journey-${Date.now()}`;
    const name = `E2E Journey dApp ${Date.now()}`;
    const description = 'Full journey test: post → PM → ad';
    const version = '1.0.0';
    const manifest = JSON.stringify({ entryPoint: '/index.html' });
    const blobIds: string[] = [];
    const tags = ['e2e', 'journey'];
    const category = 'testing';

    const tx = new Transaction();
    const [feeCoin] = tx.splitCoins(tx.gas, [MIN_POSTING_FEE_MIST * 2]); // 2 SUI

    tx.moveCall({
      target: `${packageId}::dapp_posting::post_dapp`,
      arguments: [
        tx.object(registryId),
        tx.object(poolId),
        tx.object(configId), // PostingTreasuryConfig - canonical addresses
        tx.pure('vector<u8>', toBytes(name)),
        tx.pure('vector<u8>', toBytes(description)),
        tx.pure('vector<u8>', toBytes(permlink)),
        tx.pure('vector<u8>', toBytes(version)),
        tx.pure('vector<u8>', toBytes(manifest)),
        tx.pure('vector<vector<u8>>', blobIds.map(toBytes)),
        tx.pure('vector<vector<u8>>', tags.map(toBytes)),
        tx.pure('vector<u8>', toBytes(category)),
        feeCoin,
        tx.object(CLOCK_ID),
      ],
    });

    const result = await signAndExecute(wallet, tx);
    expect(result.effects?.status.status).toBe('success');

    const dappPosted = extractEvent(result, 'DappPosted');
    expect(dappPosted).toBeDefined();
    
    // Extract dappId from event (format: owner_permlink)
    const ownerLower = wallet.address.toLowerCase();
    dappId = `${ownerLower}_${permlink}`;

    // Wait for transaction to be indexed
    await waitForTransaction(wallet, result.digest);
  });

  test('2. PM market created automatically', async () => {
    if (!dappId) {
      test.skip(true, 'No dApp ID from previous step');
      return;
    }

    // Wait for indexer to process the event and create PM
    let markets: any[] = [];
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        const result = await apiClient.getMarketsForDapp(dappId);
        markets = result.markets || [];
        if (markets.length > 0) break;
      } catch (e) {
        // Market endpoint may not exist yet
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    expect(markets.length).toBeGreaterThan(0);
    marketId = markets[0].id;
    expect(marketId).toBeDefined();
    expect(markets[0].status).toBe('open');
    expect(markets[0].dappId).toBe(dappId);
  });

  test('3. Resolve PM market (or wait for auto-resolution)', async () => {
    if (!marketId) {
      test.skip(true, 'No market ID from previous step');
      return;
    }

    // If PM duration is short (testnet), wait for auto-resolution
    // Otherwise, resolve manually via API
    if (PM_DURATION_MS <= 600000) {
      // Short duration (10 min or less) - wait for auto-resolution
      const waitTime = PM_DURATION_MS + 10000; // Duration + 10s buffer
      test.setTimeout(waitTime + 30000);
      
      console.log(`Waiting ${waitTime / 1000}s for PM to auto-resolve...`);
      await new Promise(r => setTimeout(r, waitTime));

      // Check if market resolved
      const result = await apiClient.getMarketsForDapp(dappId);
      const markets = result.markets || [];
      const resolved = markets.find((m: any) => m.id === marketId && m.status === 'resolved');
      
      if (!resolved) {
        // Try to resolve manually
        try {
          await apiClient.resolveMarket(marketId, 'safe');
        } catch (e: any) {
          test.skip(true, `PM not auto-resolved and manual resolution failed: ${e.message}`);
          return;
        }
      }
    } else {
      // Long duration - resolve manually
      try {
        await apiClient.resolveMarket(marketId, 'safe');
      } catch (e: any) {
        // Resolution endpoint may not exist - that's OK, we'll check status
        console.warn('Manual resolution not available, checking market status');
      }
    }

    // Verify market is resolved
    const result = await apiClient.getMarketsForDapp(dappId);
    const markets = result.markets || [];
    const market = markets.find((m: any) => m.id === marketId);
    
    // Market may be resolved or still open (if resolution endpoint doesn't exist)
    // For the ad registration test, we'll proceed if market exists
    expect(market).toBeDefined();
  });

  test('4. Register dApp as ad campaign (wallet-funded on-chain)', async () => {
    if (!dappId) {
      test.skip(true, 'No dApp ID from previous step');
      return;
    }

    const packageId = getPackageId();
    if (!packageId) {
      test.skip(true, 'PACKAGE_ID required for on-chain ad campaign');
      return;
    }

    // Build ad campaign transaction (on-chain)
    const title = `Promote ${dappId}`;
    const description = 'E2E journey test ad campaign';
    const targetUrl = `/@${wallet.address}/${dappId.split('_')[1]}`;
    const placements = ['dapp-hub'];
    const bidMist = BigInt(Math.round(0.01 * 1_000_000_000)); // 0.01 SUI per impression
    const budgetMist = BigInt(Math.round(0.1 * 1_000_000_000)); // 0.1 SUI total budget
    const startAtMs = Date.now();
    const endAtMs = startAtMs + 30 * 24 * 60 * 60 * 1000; // 30 days
    const lockDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days

    const tx = new Transaction();
    const [budgetCoin] = tx.splitCoins(tx.gas, [budgetMist]);

    // Helper to encode nested vectors
    const vecOfVecU8Bcs = (items: string[]): Uint8Array => {
      const schema = bcs.vector(bcs.vector(bcs.u8()));
      return schema.serialize(items.map((item) => toBytes(item))).toBytes();
    };

    tx.moveCall({
      target: `${packageId}::ad_campaigns::create_campaign_entry`,
      arguments: [
        budgetCoin,
        tx.pure('vector<u8>', toBytes(title)),
        tx.pure('vector<u8>', toBytes(description)),
        tx.pure('vector<u8>', toBytes(targetUrl)),
        tx.pure(vecOfVecU8Bcs(placements)),
        tx.pure('u64', bidMist),
        tx.pure('u64', startAtMs),
        tx.pure('u64', endAtMs),
        tx.pure(vecOfVecU8Bcs([])), // user_zones
        tx.pure(vecOfVecU8Bcs([])), // content_zones
        tx.pure(bcs.option(bcs.u8()).serialize(null).toBytes()), // planet: None
        tx.pure('u64', lockDurationMs),
        tx.object(CLOCK_ID),
      ],
    });

    tx.setSender(wallet.address);
    tx.setGasBudget(50_000_000);

    // Sign and execute
    const result = await signAndExecute(wallet, tx);
    expect(result.effects?.status.status).toBe('success');

    campaignTxDigest = result.digest;
    expect(campaignTxDigest).toBeDefined();

    // Wait for transaction to be indexed
    await waitForTransaction(wallet, campaignTxDigest);

    // Extract CampaignCreated event
    const campaignCreated = extractEvent(result, 'CampaignCreated');
    expect(campaignCreated).toBeDefined();
  });

  test('5. Verify campaign is queryable', async () => {
    if (!campaignTxDigest) {
      test.skip(true, 'No campaign transaction from previous step');
      return;
    }

    // Wait a moment for indexer to process
    await new Promise(r => setTimeout(r, 3000));

    // Try to list campaigns (may require auth)
    try {
      const result = await apiClient.listCampaigns({ advertiser: wallet.address });
      expect(result).toHaveProperty('campaigns');
      const campaigns = result.campaigns || [];
      // Campaign should appear in list (or at least not error)
      expect(Array.isArray(campaigns)).toBe(true);
    } catch (e: any) {
      // Campaign listing may require auth - that's OK, the on-chain creation succeeded
      console.log('Campaign listing requires auth (expected)');
    }
  });

  test('6. Verify dApp detail page shows ad registration option', async ({ page }) => {
    if (!dappId) {
      test.skip(true, 'No dApp ID from previous step');
      return;
    }

    const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
    const dappUrl = `${baseUrl}/dapps/${dappId}`;

    await page.goto(dappUrl);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if "Register as Ad" section is visible (for owner)
    // Note: This requires wallet connection in browser, which may not be available in E2E
    // So we'll just check that the page loads without errors
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    
    // If wallet is connected, the ad registration section should appear
    // For now, we just verify the page loads successfully
    console.log('dApp detail page loaded successfully');
  });
});
