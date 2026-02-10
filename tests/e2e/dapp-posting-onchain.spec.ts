/**
 * E2E: On-chain dApp posting via wallet transaction (testnet).
 * Uses SuiClient + wallet keypair to sign and execute post_dapp moveCall.
 *
 * Prerequisites:
 * - Contracts deployed to testnet: npm run deploy:contracts:testnet
 * - PACKAGE_ID and POSTING_POOL_ID set (from deploy output or .package_id /.posting_pool_id)
 * - Funded wallet: TEST_ADVERTISER_PRIVATE_KEY or TEST_SLUSH_MNEMONIC
 *
 * Run: PACKAGE_ID=0x... POSTING_POOL_ID=0x... TEST_ADVERTISER_PRIVATE_KEY=... npx playwright test dapp-posting-onchain
 */

import { test, expect } from '@playwright/test';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ensureWalletFunded, loadTestKeypair, loadSlushKeypairFromMnemonic, signAndExecute, extractEvent } from './helpers/wallet-helpers';

const SUI_RPC_URL = process.env.SUI_RPC_URL
  || (process.env.E2E_BASE_URL?.includes('test.dlux.io') ? 'https://fullnode.testnet.sui.io:443' : 'http://localhost:9000');
const CLOCK_ID = '0x6';
const MIN_POSTING_FEE_MIST = 1_000_000_000; // 1 SUI

function getPackageId(): string {
  const env = process.env.PACKAGE_ID;
  if (env) return env;
  const scriptDir = resolve(__dirname, 'scripts');
  const f = resolve(scriptDir, '.package_id');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  return '';
}

function getPostingPoolId(): string {
  const env = process.env.POSTING_POOL_ID;
  if (env) return env;
  const scriptDir = resolve(__dirname, 'scripts');
  const f = resolve(scriptDir, '.posting_pool_id');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  return '';
}

function getPostingTreasuryConfigId(): string {
  const env = process.env.POSTING_TREASURY_CONFIG_ID;
  if (env) return env;
  const scriptDir = resolve(__dirname, 'scripts');
  const f = resolve(scriptDir, '.posting_treasury_config_id');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  return '';
}

function getPostingRegistryId(): string {
  const env = process.env.POSTING_REGISTRY_ID;
  if (env) return env;
  const scriptDir = resolve(__dirname, 'scripts');
  const f = resolve(scriptDir, '.posting_registry_id');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  return '';
}

const toBytes = (s: string) => Array.from(new TextEncoder().encode(s));

test.describe('dApp posting - on-chain wallet transaction', () => {
  test.setTimeout(60000);

  test('post_dapp on-chain with funded wallet', async () => {
    const packageId = getPackageId();
    const poolId = getPostingPoolId();
    const registryId = getPostingRegistryId();
    const configId = getPostingTreasuryConfigId();
    if (!packageId || !poolId || !registryId || !configId) {
      test.skip(true, 'PACKAGE_ID, POSTING_POOL_ID, POSTING_REGISTRY_ID, and POSTING_TREASURY_CONFIG_ID required');
      return;
    }

    const keypair = loadSlushKeypairFromMnemonic() || loadTestKeypair('payer');
    const client = new SuiClient({ url: SUI_RPC_URL });
    const address = keypair.toSuiAddress();
    const wallet = { keypair, address, client };

    const funded = await ensureWalletFunded(wallet, BigInt(50_000_000)); // 0.05 SUI (post + gas)
    if (!funded) {
      test.skip(true, `Wallet ${address} needs funding - use faucet.sui.io or set TEST_ADVERTISER_PRIVATE_KEY`);
      return;
    }

    const permlink = `e2e-onchain-${Date.now()}`;
    const name = `E2E On-Chain dApp ${Date.now()}`;
    const description = 'Posted via wallet transaction for E2E test';
    const version = '1.0.0';
    const manifest = JSON.stringify({ entryPoint: '/index.html' });
    const blobIds: string[] = [];
    const tags = ['e2e', 'onchain'];
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
    expect(dappPosted).toHaveProperty('posting_fee');
  });
});
