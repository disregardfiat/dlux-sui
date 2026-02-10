/**
 * Wallet helpers for E2E tests with real wallet signing
 *
 * Key pair reuse:
 * - payer: advertiser (ad-journey), subscriber (subscription) — needs funding
 * - receiver: creator (subscription) — receives SUI, no funding needed
 * - slush: TEST_SLUSH_MNEMONIC (12-word phrase) — for Slush E2E tests
 *
 * Env vars (checked in order):
 * - payer: TEST_ADVERTISER_PRIVATE_KEY | TEST_WALLET_1_PRIVATE_KEY
 * - receiver: TEST_CREATOR_PRIVATE_KEY | TEST_WALLET_2_PRIVATE_KEY
 * - slush: TEST_SLUSH_MNEMONIC (12-word mnemonic for import/restore)
 */

import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromB64 } from '@mysten/sui/utils';

export interface TestWallet {
  keypair: Ed25519Keypair;
  address: string;
  client: SuiClient;
}

/**
 * Load a test keypair by role. Reuses same keys across ad-journey, subscription, etc.
 * @param role 'payer' = spends SUI (advertiser, subscriber); 'receiver' = receives (creator)
 */
export function loadTestKeypair(role: 'payer' | 'receiver'): Ed25519Keypair {
  const envKey =
    role === 'payer'
      ? process.env.TEST_ADVERTISER_PRIVATE_KEY || process.env.TEST_WALLET_1_PRIVATE_KEY
      : process.env.TEST_CREATOR_PRIVATE_KEY || process.env.TEST_WALLET_2_PRIVATE_KEY;

  if (envKey) {
    const secretKey = envKey.startsWith('suiprivkey1') ? envKey : fromB64(envKey);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  return new Ed25519Keypair();
}

/**
 * Derive Slush test wallet keypair from 12-word mnemonic.
 * Use TEST_SLUSH_MNEMONIC env var. Same phrase = same address across runs.
 */
export function loadSlushKeypairFromMnemonic(): Ed25519Keypair | null {
  const mnemonic = process.env.TEST_SLUSH_MNEMONIC?.trim();
  if (!mnemonic) return null;
  try {
    return Ed25519Keypair.deriveKeypair(mnemonic);
  } catch {
    return null;
  }
}

/**
 * Get Slush test wallet address for funding (faucet).
 * Returns null if TEST_SLUSH_MNEMONIC not set.
 */
export function getSlushTestAddress(): string | null {
  const kp = loadSlushKeypairFromMnemonic();
  return kp ? kp.toSuiAddress() : null;
}

/**
 * Create or load a test wallet
 */
function getDefaultRpcUrl(): string {
  if (process.env.SUI_RPC_URL) return process.env.SUI_RPC_URL;
  if (process.env.E2E_BASE_URL?.includes('test.dlux.io')) return 'https://fullnode.testnet.sui.io:443';
  return 'http://localhost:9000';
}

export function createTestWallet(
  privateKeyBase64?: string,
  rpcUrl: string = getDefaultRpcUrl()
): TestWallet {
  const client = new SuiClient({ url: rpcUrl });
  
  let keypair: Ed25519Keypair;
  if (privateKeyBase64) {
    keypair = Ed25519Keypair.fromSecretKey(fromB64(privateKeyBase64));
  } else {
    // Generate new keypair
    keypair = new Ed25519Keypair();
  }

  return {
    keypair,
    address: keypair.toSuiAddress(),
    client,
  };
}

/**
 * Ensure wallet has sufficient SUI for gas
 */
export async function ensureWalletFunded(
  wallet: TestWallet,
  minBalance: bigint = BigInt(1000000000) // 1 SUI
): Promise<boolean> {
  const coins = await wallet.client.getCoins({
    owner: wallet.address,
    coinType: '0x2::sui::SUI',
  });

  const totalBalance = coins.data.reduce(
    (sum, coin) => sum + BigInt(coin.balance),
    BigInt(0)
  );

  if (totalBalance < minBalance) {
    // Try to request from faucet (for local validator or testnet)
    try {
      const faucetUrl = process.env.SUI_FAUCET_URL
        || (process.env.E2E_BASE_URL?.includes('test.dlux.io') ? 'https://faucet.testnet.sui.io/v2/gas' : 'http://localhost:9123/gas');
      await fetch(faucetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          FixedAmountRequest: {
            recipient: wallet.address,
          },
        }),
      });

      // Wait a bit for faucet to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check again
      const newCoins = await wallet.client.getCoins({
        owner: wallet.address,
        coinType: '0x2::sui::SUI',
      });
      const newBalance = newCoins.data.reduce(
        (sum, coin) => sum + BigInt(coin.balance),
        BigInt(0)
      );

      return newBalance >= minBalance;
    } catch (error) {
      console.warn(`Failed to fund wallet ${wallet.address}:`, error);
      return false;
    }
  }

  return true;
}

/**
 * Sign and execute a transaction block
 */
export async function signAndExecute(
  wallet: TestWallet,
  transaction: Transaction,
  options?: {
    showEffects?: boolean;
    showEvents?: boolean;
    showObjectChanges?: boolean;
  }
) {
  return await wallet.client.signAndExecuteTransaction({
    signer: wallet.keypair,
    transaction,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      ...options,
    },
  });
}

/**
 * Get object by ID
 */
export async function getObject(
  wallet: TestWallet,
  objectId: string,
  options?: { showContent?: boolean; showOwner?: boolean; showPreviousTransaction?: boolean }
) {
  return await wallet.client.getObject({
    id: objectId,
    options: {
      showContent: true,
      showOwner: true,
      ...options,
    },
  });
}

/**
 * Get coins for an address
 */
export async function getCoins(
  wallet: TestWallet,
  coinType: string = '0x2::sui::SUI'
) {
  return await wallet.client.getCoins({
    owner: wallet.address,
    coinType,
  });
}

/**
 * Get total balance for an address
 */
export async function getBalance(
  wallet: TestWallet,
  coinType: string = '0x2::sui::SUI'
): Promise<bigint> {
  const coins = await getCoins(wallet, coinType);
  return coins.data.reduce(
    (sum, coin) => sum + BigInt(coin.balance),
    BigInt(0)
  );
}

/**
 * Wait for transaction to be indexed
 */
export async function waitForTransaction(
  wallet: TestWallet,
  digest: string,
  timeout: number = 30000
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const tx = await wallet.client.getTransactionBlock({
        digest,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });
      
      if (tx.effects?.status.status === 'success') {
        return;
      }
    } catch (error) {
      // Transaction not found yet, wait and retry
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Transaction ${digest} not confirmed within ${timeout}ms`);
}

/**
 * Extract event data from transaction result
 */
export function extractEvent<T = any>(
  result: Awaited<ReturnType<typeof signAndExecute>>,
  eventType: string
): T | undefined {
  const event = result.events?.find((e) => e.type.includes(eventType));
  return event?.parsedJson as T | undefined;
}

/**
 * Extract created objects from transaction result
 */
export function extractCreatedObjects(
  result: Awaited<ReturnType<typeof signAndExecute>>,
  objectType?: string
) {
  return result.objectChanges
    ?.filter(
      (change) =>
        change.type === 'created' &&
        (!objectType || change.objectType?.includes(objectType))
    )
    .map((change) => {
      if (change.type === 'created') {
        return {
          objectId: change.objectId,
          objectType: change.objectType,
        };
      }
      return null;
    })
    .filter((obj) => obj !== null) || [];
}
