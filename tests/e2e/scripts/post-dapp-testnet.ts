#!/usr/bin/env npx tsx
/**
 * Post a test dApp on-chain via dapp_posting::post_dapp.
 * Proves the full chain: wallet → on-chain tx → events emitted → indexer picks up.
 *
 * Usage:
 *   npx tsx tests/e2e/scripts/post-dapp-testnet.ts
 *
 * Env:
 *   PACKAGE_ID                   – deployed package ID (default: reads from .package_id)
 *   POSTING_POOL_ID              – PostingFeePool object (default: reads from .posting_pool_id)
 *   POSTING_TREASURY_CONFIG_ID   – PostingTreasuryConfig object (canonical addresses)
 *   SUI_RPC_URL                  – RPC URL (default: testnet)
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bcs } from '@mysten/sui/bcs';
import * as fs from 'fs';
import * as path from 'path';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);

function readFileOrEnv(envKey: string, filename: string): string {
  if (process.env[envKey]) return process.env[envKey]!;
  try {
    return fs.readFileSync(path.join(SCRIPT_DIR, filename), 'utf8').trim();
  } catch {
    throw new Error(`${envKey} not set and ${filename} not found in ${SCRIPT_DIR}`);
  }
}

async function main() {
  const packageId = readFileOrEnv('PACKAGE_ID', '.package_id');
  const poolId = readFileOrEnv('POSTING_POOL_ID', '.posting_pool_id');
  const registryId = readFileOrEnv('POSTING_REGISTRY_ID', '.posting_registry_id');
  const configId = readFileOrEnv('POSTING_TREASURY_CONFIG_ID', '.posting_treasury_config_id');
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');

  console.log('=== Post dApp on SUI ===');
  console.log(`Package:  ${packageId}`);
  console.log(`Pool:     ${poolId}`);
  console.log(`Config:   ${configId}`);
  console.log(`RPC:      ${rpcUrl}`);

  const client = new SuiClient({ url: rpcUrl });

  // Use the active keypair from SUI keystore
  // The active address is determined by sui client active-address
  const targetAddress = '0x630572a8aab639319188b15eac3a46b0bda02633a0023a19d704dc6ab1b41ace';
  let keypair: Ed25519Keypair;
  try {
    const keystorePath = path.join(
      process.env.HOME || '~',
      '.sui',
      'sui_config',
      'sui.keystore'
    );
    const keystore: string[] = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
    // Find the key that matches the target address
    let found = false;
    for (const keyB64 of keystore) {
      const rawKey = Buffer.from(keyB64, 'base64');
      // First byte is scheme flag (0x00 = Ed25519)
      if (rawKey[0] !== 0x00) continue;
      const kp = Ed25519Keypair.fromSecretKey(rawKey.slice(1));
      if (kp.getPublicKey().toSuiAddress() === targetAddress) {
        keypair = kp;
        found = true;
        break;
      }
    }
    if (!found) {
      // Fallback: try the last key (likely testnet-deployer)
      const rawKey = Buffer.from(keystore[keystore.length - 1], 'base64');
      keypair = Ed25519Keypair.fromSecretKey(rawKey.slice(1));
    }
  } catch (e) {
    console.error('Could not read SUI keystore:', e);
    process.exit(1);
  }

  const sender = keypair.getPublicKey().toSuiAddress();
  console.log(`Sender:   ${sender}`);

  // Check balance
  const balance = await client.getBalance({ owner: sender });
  console.log(`Balance:  ${Number(balance.totalBalance) / 1e9} SUI`);

  if (Number(balance.totalBalance) < 2_000_000) {
    console.error('Insufficient balance. Fund via https://faucet.sui.io/');
    process.exit(1);
  }

  // Build transaction
  const toBytes = (s: string): number[] => Array.from(new TextEncoder().encode(s));

  const tx = new Transaction();
  const feeMist = 1_000_000_000n; // 1 SUI minimum
  const [feeCoin] = tx.splitCoins(tx.gas, [feeMist]);

  // BCS-encode vector<vector<u8>> for blob_ids and tags
  const vecOfVecU8 = bcs.vector(bcs.vector(bcs.u8()));
  const blobIdsBcs = vecOfVecU8.serialize([toBytes('blob_test_001')]).toBytes();
  const tagsBcs = vecOfVecU8.serialize([toBytes('test'), toBytes('ralph')]).toBytes();

  tx.moveCall({
    target: `${packageId}::dapp_posting::post_dapp`,
    arguments: [
      tx.object(registryId),                           // registry: &mut DappRegistry
      tx.object(poolId),                               // pool
      tx.object(configId),                             // config: &PostingTreasuryConfig
      tx.pure.vector('u8', toBytes('hello-world')),   // name
      tx.pure.vector('u8', toBytes('Test dApp posted on-chain by Ralph')), // description
      tx.pure.vector('u8', toBytes('hello-world')),   // permlink
      tx.pure.vector('u8', toBytes('1.0.0')),         // version
      tx.pure.vector('u8', toBytes('{"entryPoint":"/index.html"}')), // manifest
      tx.pure(blobIdsBcs),                            // blob_ids: vector<vector<u8>>
      tx.pure(tagsBcs),                               // tags: vector<vector<u8>>
      tx.pure.vector('u8', toBytes('utility')),       // category
      feeCoin,                                        // posting_fee: Coin<SUI>
      tx.object('0x6'),                               // clock: &Clock
    ],
  });

  tx.setSender(sender);
  tx.setGasBudget(50_000_000);

  console.log('\nSigning and executing transaction...');

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });

  console.log('\n=== Transaction Result ===');
  console.log(`Status:   ${result.effects?.status?.status}`);
  console.log(`Digest:   ${result.digest}`);
  console.log(`Explorer: https://suiscan.xyz/testnet/tx/${result.digest}`);

  if (result.events && result.events.length > 0) {
    console.log(`\nEvents (${result.events.length}):`);
    for (const event of result.events) {
      console.log(`  Type: ${event.type}`);
      console.log(`  Data: ${JSON.stringify(event.parsedJson, null, 2)}`);
    }
  }

  if (result.effects?.status?.status !== 'success') {
    console.error('\nTransaction FAILED:', result.effects?.status);
    process.exit(1);
  }

  console.log('\n✅ dApp posted on-chain successfully!');
  console.log('The indexer should pick up the DappPosted and PredictionMarketTriggered events.');
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
