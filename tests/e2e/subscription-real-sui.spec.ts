/**
 * Real SUI subscription E2E - testnet with low prices.
 * Platform-wide subscription: subscriber pays foundation for ad-free.
 * Transfer real SUI (e.g. 0.01) from subscriber to foundation, then POST to subscription API.
 *
 * Run: npm run test:e2e:testnet -- tests/e2e/subscription-real-sui.spec.ts
 * FOUNDATION_ADDRESS env var for recipient
 */

import { test, expect } from '@playwright/test';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { apiClient } from './helpers/api-helpers';
import { ensureWalletFunded, loadTestKeypair } from './helpers/wallet-helpers';

const SUI_RPC_URL = process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443';
const SUBSCRIPTION_PRICE_SUI = Number(process.env.SUBSCRIPTION_PRICE_SUI || '0.01');
const FOUNDATION_ADDRESS = process.env.FOUNDATION_ADDRESS || '0x3d4e565f798ad88b8e99882f37ab1198430c58ff0ecdca70c57cf16bc9fd84ec';

test.describe('Subscription - Real SUI (testnet)', () => {
  let suiClient: SuiClient;
  let subscriberKeypair: ReturnType<typeof loadTestKeypair>;
  let subscriberAddress: string;

  test.beforeAll(async () => {
    suiClient = new SuiClient({ url: SUI_RPC_URL });

    subscriberKeypair = loadTestKeypair('payer');
    subscriberAddress = subscriberKeypair.toSuiAddress();

    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    if (!dgraphHealthy) {
      test.skip(true, 'DGraph service not available');
      return;
    }

    const funded = await ensureWalletFunded(
      { keypair: subscriberKeypair, address: subscriberAddress, client: suiClient },
      BigInt(1000000000)
    );
    if (!funded) {
      console.warn(
        `Subscriber ${subscriberAddress} needs funding. Set TEST_ADVERTISER_PRIVATE_KEY and SUI_FAUCET_URL`
      );
    }
  });

  test('should transfer SUI to foundation and create platform subscription', async () => {
    const amountMist = BigInt(Math.round(SUBSCRIPTION_PRICE_SUI * 1_000_000_000));
    if (amountMist <= 0n) {
      test.skip(true, 'SUBSCRIPTION_PRICE_SUI must be positive');
      return;
    }

    const coins = await suiClient.getCoins({
      owner: subscriberAddress,
      coinType: '0x2::sui::SUI',
    });
    if (coins.data.length === 0) {
      test.skip('No SUI available for subscription payment');
      return;
    }

    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [amountMist]);
    tx.transferObjects([coin], FOUNDATION_ADDRESS);
    tx.setSender(subscriberAddress);

    const result = await suiClient.signAndExecuteTransaction({
      signer: subscriberKeypair,
      transaction: tx,
      options: { showEffects: true },
    });

    expect(result.effects?.status.status).toBe('success');
    const digest = result.digest;
    expect(digest).toBeTruthy();

    await suiClient.waitForTransaction({ digest, timeout: 30000 });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const subRes = await apiClient.createSubscription({
      subscriber: subscriberAddress,
      paymentTxId: digest,
      expiresAt,
    });

    expect(subRes.success).toBe(true);
    expect(subRes.paymentTxId).toBe(digest);
    expect(subRes.recipient).toBe(FOUNDATION_ADDRESS);

    const status = await apiClient.getSubscriptionStatus(subscriberAddress);
    expect(status.active).toBe(true);
    expect(status.subscriptions?.length).toBeGreaterThan(0);
  });
});
