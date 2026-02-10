/**
 * Composable for posting dApps on-chain via the dapp_posting Move contract.
 *
 * Flow: User fills form → buildPostDappTransaction() → wallet signs → SUI chain
 *       → indexer picks up DappPosted event → dappProcessor → DGraph
 *
 * This is the "on-chain" path for Phase 0c. The user pays gas + posting fee.
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

const MIST_PER_SUI = 1_000_000_000;

// RPC URL from env, with network-specific defaults
const getDefaultRPC = (): string => {
  const envRpc = import.meta.env.VITE_SUI_RPC_URL;
  if (envRpc) return envRpc;
  
  const packageId = import.meta.env.VITE_SUI_PACKAGE_ID || '';
  const isMainnet = packageId && !packageId.includes('testnet');
  
  return isMainnet 
    ? 'https://fullnode.mainnet.sui.io:443'
    : 'https://fullnode.testnet.sui.io:443';
};

const DEFAULT_RPC = getDefaultRPC();

/**
 * Package ID of the deployed dapp_posting contract.
 * Set via VITE_SUI_PACKAGE_ID or read from environment.
 */
export const PACKAGE_ID =
  import.meta.env.VITE_SUI_PACKAGE_ID || '';

/**
 * Shared PostingFeePool object ID (created at contract init).
 * Set via VITE_POSTING_POOL_ID.
 */
export const POSTING_POOL_ID =
  import.meta.env.VITE_POSTING_POOL_ID || '';

/**
 * PostingTreasuryConfig object ID (canonical PM/foundation addresses - caller cannot override).
 * Set via VITE_POSTING_TREASURY_CONFIG_ID.
 */
export const POSTING_TREASURY_CONFIG_ID =
  import.meta.env.VITE_POSTING_TREASURY_CONFIG_ID || '';

/**
 * DappRegistry object ID (claimed permlinks + records for time lock / mute).
 * Set via VITE_POSTING_REGISTRY_ID.
 */
export const POSTING_REGISTRY_ID =
  import.meta.env.VITE_POSTING_REGISTRY_ID || '';

/**
 * GovernanceConfig shared object ID (votable parameters: PM duration, fees, splits).
 * Set via VITE_GOVERNANCE_CONFIG_ID.
 */
export const GOVERNANCE_CONFIG_ID =
  import.meta.env.VITE_GOVERNANCE_CONFIG_ID || '';

/** SUI Clock object (always 0x6 on all networks) */
const CLOCK_OBJECT_ID = '0x6';

let clientInstance: SuiClient | null = null;

function getClient(): SuiClient {
  if (!clientInstance) {
    clientInstance = new SuiClient({ url: DEFAULT_RPC });
  }
  return clientInstance;
}

/** Execute a signed transaction via our RPC (bypasses wallet's Enoki fetch). */
export async function executeSignedTransaction(
  transactionBlockBytes: string,
  signature: string
): Promise<{ digest: string }> {
  const client = getClient();
  const result = await client.executeTransactionBlock({
    transactionBlock: transactionBlockBytes,
    signature,
    options: { showEffects: true, showEvents: true }
  });
  const digest = result.digest ?? (result as any).effects?.transactionDigest;
  if (!digest) {
    throw new Error('No transaction digest from executeTransactionBlock');
  }
  return { digest };
}

/** Encode a string to bytes for Move vector<u8> parameters. */
function toBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

export interface PostDAppOnChainParams {
  sender: string;
  name: string;
  description: string;
  permlink: string;
  version: string;
  manifest: string; // JSON-serialized manifest
  blobIds: string[];
  blobSizes: number[]; // Blob sizes in bytes (must match blobIds length)
  tags: string[];
  category: string;
  postingFeeSui: number; // In SUI (e.g. 0.001)
}

/**
 * Build a SUI transaction that calls dapp_posting::post_dapp on-chain.
 * Returns the Transaction object so the wallet can serialize/build and sign it
 * (Wallet Standard expects Transaction with .serialize(), not raw bytes).
 *
 * The user pays gas + postingFee. The posting fee goes to the PostingFeePool.
 */
export async function buildPostDappTransaction(
  params: PostDAppOnChainParams
): Promise<Transaction> {
  const packageId = PACKAGE_ID;
  const poolId = POSTING_POOL_ID;
  const registryId = POSTING_REGISTRY_ID;
  const configId = POSTING_TREASURY_CONFIG_ID;
  const govConfigId = GOVERNANCE_CONFIG_ID;
  if (!packageId || !poolId || !registryId || !configId || !govConfigId) {
    throw new Error(
      'VITE_SUI_PACKAGE_ID, VITE_POSTING_POOL_ID, VITE_POSTING_REGISTRY_ID, VITE_POSTING_TREASURY_CONFIG_ID, and VITE_GOVERNANCE_CONFIG_ID must be configured. Set them in .env.'
    );
  }

  const amountMist = BigInt(
    Math.max(Math.round(params.postingFeeSui * MIST_PER_SUI), 1_000_000)
  );

  const tx = new Transaction();

  // Split posting fee coin from gas
  const [feeCoin] = tx.splitCoins(tx.gas, [amountMist]);

  // Call dapp_posting::post_dapp (registry, pool, config, gov; storage cost → Walrus, remainder → PM/foundation)
  tx.moveCall({
    target: `${packageId}::dapp_posting::post_dapp`,
    arguments: [
      tx.object(registryId),                             // registry: &mut DappRegistry
      tx.object(poolId),                                 // pool: &mut PostingFeePool
      tx.object(configId),                               // config: &PostingTreasuryConfig
      tx.object(govConfigId),                            // gov: &GovernanceConfig
      tx.pure.vector('u8', toBytes(params.name)),        // name: vector<u8>
      tx.pure.vector('u8', toBytes(params.description)), // description: vector<u8>
      tx.pure.vector('u8', toBytes(params.permlink)),    // permlink: vector<u8>
      tx.pure.vector('u8', toBytes(params.version)),     // version: vector<u8>
      tx.pure.vector('u8', toBytes(params.manifest)),    // manifest: vector<u8>
      tx.pure(vecOfVecU8Bcs(params.blobIds)),            // blob_ids: vector<vector<u8>>
      tx.pure(bcs.vector(bcs.u64()).serialize(params.blobSizes.map((s: number) => BigInt(s))).toBytes()), // blob_sizes: vector<u64>
      tx.pure(vecOfVecU8Bcs(params.tags)),               // tags: vector<vector<u8>>
      tx.pure.vector('u8', toBytes(params.category)),    // category: vector<u8>
      feeCoin,                                            // posting_fee: Coin<SUI>
      tx.object(CLOCK_OBJECT_ID),                         // clock: &Clock
    ],
  });

  tx.setSender(params.sender);
  tx.setGasBudget(50_000_000); // 0.05 SUI gas budget

  return tx;
}

/** BCS-encode an array of strings as vector<vector<u8>> for Move. */
function vecOfVecU8Bcs(items: string[]): Uint8Array {
  const schema = bcs.vector(bcs.vector(bcs.u8()));
  return schema.serialize(items.map((item) => toBytes(item))).toBytes();
}

/**
 * Check if on-chain posting is configured (PACKAGE_ID, POSTING_POOL_ID, POSTING_REGISTRY_ID, POSTING_TREASURY_CONFIG_ID).
 */
export function isOnChainPostingAvailable(): boolean {
  return !!PACKAGE_ID && !!POSTING_POOL_ID && !!POSTING_REGISTRY_ID && !!POSTING_TREASURY_CONFIG_ID && !!GOVERNANCE_CONFIG_ID;
}

/**
 * Convenience: convert SUI to MIST.
 */
export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * MIST_PER_SUI));
}
