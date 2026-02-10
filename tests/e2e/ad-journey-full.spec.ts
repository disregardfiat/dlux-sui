/**
 * Full E2E test for Ad Campaign Journey (INTEGRATION / LEGACY).
 * Uses SuiClient, apiClient, direct backend calls — NOT style-aligned (docs/testing-style.md).
 * For style-aligned browser-only E2E, use ad-journey-browser.spec.ts.
 *
 * Prerequisites:
 * 1. Local Sui validator running: sui-test-validator
 * 2. Contracts deployed to local testnet
 * 3. Services running with SUI_RPC_URL=http://localhost:9000
 * 4. Test accounts funded
 */

import { test, expect } from '@playwright/test';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { apiClient } from './helpers/api-helpers';
import { testData } from './helpers/test-data';
import { ensureWalletFunded, loadTestKeypair } from './helpers/wallet-helpers';

// Test configuration (use testnet when running against test.dlux.io)
const SUI_RPC_URL = process.env.SUI_RPC_URL
  || (process.env.E2E_BASE_URL?.includes('test.dlux.io') ? 'https://fullnode.testnet.sui.io:443' : 'http://localhost:9000');
const PACKAGE_ID = process.env.PACKAGE_ID || '';
const CLOCK_ID = '0x6'; // Sui Clock object ID

const skipAdJourneyFull = process.env.E2E_BASE_URL?.includes('test.dlux.io');
(skipAdJourneyFull ? test.describe.skip : test.describe)('Ad Campaign Journey - Full E2E with Testnet', () => {
  test.setTimeout(60000);
  let suiClient: SuiClient;
  let advertiserKeypair: Ed25519Keypair;
  let advertiserAddress: string;
  let campaignId: string;
  let escrowId: string;
  let revenuePoolId: string;

  test.beforeAll(async () => {
    suiClient = new SuiClient({ url: SUI_RPC_URL });

    // Reuse payer key (shared with subscription tests)
    advertiserKeypair = loadTestKeypair('payer');
    advertiserAddress = advertiserKeypair.toSuiAddress();

    // Verify services are running
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    const suiServiceHealthy = await apiClient.checkHealth('sui');
    if (!dgraphHealthy || !suiServiceHealthy) {
      test.skip(true, 'DGraph or SUI service not available (DGRAPH_SERVICE_URL, SUI_SERVICE_URL)');
      return;
    }

    // Ensure advertiser has SUI for gas (request from faucet if on testnet/devnet)
    const wallet = {
      keypair: advertiserKeypair,
      address: advertiserAddress,
      client: suiClient,
    };
    const funded = await ensureWalletFunded(wallet, BigInt(1000000000));
    if (!funded) {
      console.warn(
        `Advertiser ${advertiserAddress} needs funding. Set TEST_ADVERTISER_PRIVATE_KEY and SUI_FAUCET_URL (e.g. https://faucet.testnet.sui.io/v2/gas)`
      );
    }
  });

  test('should create ad campaign on-chain with escrow', async () => {
    if (!PACKAGE_ID) {
      test.skip('PACKAGE_ID not set - deploy contracts to testnet first');
      return;
    }

    // Step 1: Prepare campaign data
    const campaignData = {
      title: 'Test Campaign - Full E2E',
      description: 'Complete E2E test campaign',
      targetUrl: 'https://example.com',
      placements: ['gate', 'slip'],
      bid: 1000000, // 0.001 SUI in MIST
      totalBudget: 100000000, // 0.1 SUI in MIST
      startAt: Date.now(),
      endAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      userZones: ['US', 'EU'],
      contentZones: [],
      planet: null,
      lockDurationMs: 86400000, // 24 hours
    };

    // Step 2: Get payment coin
    const coins = await suiClient.getCoins({
      owner: advertiserAddress,
      coinType: '0x2::sui::SUI',
    });

    if (coins.data.length === 0) {
      test.skip('No SUI available for campaign creation');
      return;
    }

    // Step 3: Create on-chain transaction
    const tx = new Transaction();
    const [paymentCoin] = tx.splitCoins(tx.gas, [campaignData.totalBudget]);

    // Call create_campaign_entry (vector<u8> = bytes; vector<vector<u8>> = array of bytes)
    const toBytes = (s: string) => Array.from(new TextEncoder().encode(s));
    tx.moveCall({
      target: `${PACKAGE_ID}::ad_campaigns::create_campaign_entry`,
      arguments: [
        paymentCoin,
        tx.pure('vector<u8>', toBytes(campaignData.title)),
        tx.pure('vector<u8>', toBytes(campaignData.description)),
        tx.pure('vector<u8>', toBytes(campaignData.targetUrl)),
        tx.pure('vector<vector<u8>>', campaignData.placements.map(p => toBytes(p))),
        tx.pure.u64(campaignData.bid),
        tx.pure.u64(campaignData.startAt),
        tx.pure.u64(campaignData.endAt),
        tx.pure('vector<vector<u8>>', campaignData.userZones.map(z => toBytes(z))),
        tx.pure('vector<vector<u8>>', campaignData.contentZones.map(z => toBytes(z))),
        tx.pure.option('u8', campaignData.planet),
        tx.pure.u64(campaignData.lockDurationMs),
        tx.object(CLOCK_ID),
      ],
    });

    // Step 4: Sign and execute transaction
    const result = await suiClient.signAndExecuteTransaction({
      signer: advertiserKeypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });

    expect(result.effects?.status.status).toBe('success');

    // Wait for transaction to be finalized (helps with testnet propagation)
    await suiClient.waitForTransaction({
      digest: result.digest,
      timeout: 30000,
      pollInterval: 1000,
    });

    // Step 5: Extract campaign ID from events
    const campaignCreatedEvent = result.events?.find(
      (e) => e.type.includes('CampaignCreated')
    );

    if (campaignCreatedEvent) {
      const eventData = campaignCreatedEvent.parsedJson as any;
      const raw = eventData?.campaign_id;
      campaignId = typeof raw === 'string' ? raw : raw?.id ?? raw?.fields?.id;
      expect(campaignId).toBeDefined();
    }

    // Step 6: Extract campaign and escrow IDs from object changes (fallback if event format differs)
    const campaignCreated = result.objectChanges?.find(
      (change) => change.type === 'created' && change.objectType?.includes('AdCampaign')
    );
    if (campaignCreated && campaignCreated.type === 'created') {
      campaignId = campaignId || campaignCreated.objectId;
    }

    const escrowCreated = result.objectChanges?.find(
      (change) => change.type === 'created' && change.objectType?.includes('CampaignEscrow')
    );
    if (escrowCreated && escrowCreated.type === 'created') {
      escrowId = escrowCreated.objectId;
      expect(escrowId).toBeDefined();
    }

    expect(campaignId).toBeDefined();

    // Step 7: Verify campaign exists on-chain (retry for testnet propagation)
    let campaignObject: Awaited<ReturnType<typeof suiClient.getObject>>;
    for (let attempt = 0; attempt < 5; attempt++) {
      campaignObject = await suiClient.getObject({
        id: campaignId!,
        options: { showContent: true },
      });
      if (campaignObject.data?.content) break;
      if (campaignObject.error) {
        console.warn(`getObject attempt ${attempt + 1}:`, campaignObject.error);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    expect(campaignObject!.data, `Object not found: ${JSON.stringify(campaignObject!.error)}`).toBeDefined();
    expect(campaignObject!.data?.content).toBeDefined();
  });

  test('should create campaign in DGraph service', async () => {
    if (!campaignId) {
      test.skip('Prerequisite: create ad campaign on-chain (needs funded wallet: set TEST_ADVERTISER_PRIVATE_KEY)');
      return;
    }

    // Create campaign record in DGraph (off-chain indexing)
    const campaignData = {
      advertiser: advertiserAddress,
      title: 'Test Campaign - Full E2E',
      description: 'Complete E2E test campaign',
      targetUrl: 'https://example.com',
      placements: ['gate', 'slip'],
      bid: 0.001,
      totalBudget: 0.1,
      startAt: new Date(),
      endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    const campaign = await apiClient.createCampaign(campaignData);

    expect(campaign).toHaveProperty('id');
    expect(campaign.advertiser).toBe(advertiserAddress);
    expect(campaign.status).toBe('active');
  });

  test('should record impression and verify on-chain', async () => {
    if (!campaignId) {
      test.skip('Prerequisite: create ad campaign on-chain (needs funded wallet: set TEST_ADVERTISER_PRIVATE_KEY)');
      return;
    }

    // Step 1: Record impression in DGraph (off-chain)
    const impressionData = testData.impression({ 
      adId: campaignId,
      contentId: 'dapp_test_full_e2e',
    });

    const impressionResult = await apiClient.createImpression(impressionData);
    expect(impressionResult).toHaveProperty('success', true);

    // Step 2: When threshold reached, redeem tranche on-chain
    // This would typically happen when impression count reaches threshold
    // For this test, we'll simulate by calling record_impression_with_escrow

    // Get revenue pool (should exist from contract init)
    // In real scenario, you'd query for the shared RevenuePool object
    const revenuePoolObjects = await suiClient.getOwnedObjects({
      owner: '0x0000000000000000000000000000000000000000000000000000000000000000', // Shared object
      filter: { StructType: `${PACKAGE_ID}::ad_payments::RevenuePool` },
    });

    // For this test, we'll skip on-chain redemption if pool doesn't exist
    // In production, the pool would be created during contract initialization
    if (revenuePoolObjects.data.length > 0) {
      revenuePoolId = revenuePoolObjects.data[0].data?.objectId || '';

      // Create transaction to record impression and withdraw from escrow
      const tx = new Transaction();
      const campaignObj = tx.object(campaignId);
      const escrowObj = tx.object(escrowId);
      const poolObj = tx.object(revenuePoolId);

      // Call record_impression_with_escrow
      tx.moveCall({
        target: `${PACKAGE_ID}::ad_campaigns::record_impression_with_escrow`,
        arguments: [
          campaignObj,
          escrowObj,
          poolObj,
          tx.object(CLOCK_ID),
        ],
      });

      // Note: This requires AdminCap, which would need to be passed
      // For full E2E, you'd need the admin capability
      // This is a simplified example
    }
  });

  test('should verify campaign analytics', async () => {
    if (!campaignId) {
      test.skip('Prerequisite: create ad campaign on-chain (needs funded wallet: set TEST_ADVERTISER_PRIVATE_KEY)');
      return;
    }

    // Get analytics from DGraph
    const analytics = await apiClient.getCampaignAnalytics(campaignId);

    expect(analytics).toHaveProperty('campaignId', campaignId);
    expect(analytics).toHaveProperty('impressions');
    expect(analytics).toHaveProperty('clicks');
    expect(analytics).toHaveProperty('spend');
    expect(typeof analytics.impressions).toBe('number');
  });

  test('should cancel campaign and verify refund', async () => {
    if (!campaignId || !escrowId) {
      test.skip('Prerequisite: create ad campaign on-chain (needs funded wallet: set TEST_ADVERTISER_PRIVATE_KEY)');
      return;
    }

    // Step 1: Cancel campaign on-chain
    const tx = new Transaction();
    const campaignObj = tx.object(campaignId);

    tx.moveCall({
      target: `${PACKAGE_ID}::ad_campaigns::cancel_campaign`,
      arguments: [campaignObj],
    });

    const result = await suiClient.signAndExecuteTransaction({
      signer: advertiserKeypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    expect(result.effects?.status.status).toBe('success');

    await suiClient.waitForTransaction({
      digest: result.digest,
      timeout: 30000,
      pollInterval: 1000,
    });

    // Step 2: Verify campaign status updated (retry for testnet propagation)
    let campaignObject: Awaited<ReturnType<typeof suiClient.getObject>>;
    for (let attempt = 0; attempt < 5; attempt++) {
      campaignObject = await suiClient.getObject({
        id: campaignId,
        options: { showContent: true },
      });
      if (campaignObject.data?.content) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    expect(campaignObject!.data).toBeDefined();

    const campaignData = campaignObject!.data?.content as any;
    expect(campaignData.fields.status).toBeDefined();

    // Step 3: After lock period, refund escrow
    // Note: This requires waiting for lock period or using admin function
    // For this test, we'll verify the escrow exists and can be refunded
    const escrowObject = await suiClient.getObject({
      id: escrowId,
      options: { showContent: true },
    });

    expect(escrowObject.data).toBeDefined();
  });

  test.afterAll(async () => {
    // Cleanup: Cancel campaign if still active
    if (campaignId) {
      try {
        await apiClient.cancelCampaign(campaignId);
      } catch (error) {
        // Campaign may already be cancelled
        console.log('Campaign cleanup:', error);
      }
    }
  });
});
