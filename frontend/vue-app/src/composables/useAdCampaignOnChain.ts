/**
 * Composable for creating ad campaigns on-chain via the ad_campaigns Move contract.
 *
 * Flow: User fills form → buildCreateCampaignTransaction() → wallet signs → SUI chain
 *       → indexer picks up CampaignCreated event → DGraph
 *
 * The user pays gas + campaign budget (escrowed on-chain via ad_payments::create_escrow).
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

const MIST_PER_SUI = 1_000_000_000;

/**
 * Package ID of the deployed ad_campaigns contract.
 * Same package as dapp_posting (they live in the same Move package).
 */
export const PACKAGE_ID =
  import.meta.env.VITE_SUI_PACKAGE_ID || '';

/** SUI Clock object (always 0x6 on all networks) */
const CLOCK_OBJECT_ID = '0x6';

/** Encode a string to bytes for Move vector<u8> parameters. */
function toBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

/** BCS-encode an array of strings as vector<vector<u8>> for Move. */
function vecOfVecU8Bcs(items: string[]): Uint8Array {
  const schema = bcs.vector(bcs.vector(bcs.u8()));
  return schema.serialize(items.map((item) => toBytes(item))).toBytes();
}

export interface CreateCampaignOnChainParams {
  sender: string;
  title: string;
  description: string;
  targetUrl: string;
  placements: string[];
  bidSui: number;            // Bid per impression in SUI (e.g. 0.01)
  totalBudgetSui: number;    // Total budget in SUI (escrowed on-chain)
  startAt?: Date;            // Campaign start time (default: now)
  endAt?: Date;              // Campaign end time (default: 30 days from now)
  userZones?: string[];      // GeoIP zones (e.g. ["US", "EU"])
  contentZones?: string[];   // Content location zones
  lockDurationMs?: number;   // Escrow lock duration (default: 30 days)
}

/**
 * Build a SUI transaction that calls ad_campaigns::create_campaign_entry on-chain.
 * Returns the Transaction object so the wallet can sign and execute it.
 *
 * The user pays gas + totalBudgetSui. The budget is escrowed in a CampaignEscrow.
 */
export function buildCreateCampaignTransaction(
  params: CreateCampaignOnChainParams
): Transaction {
  const packageId = PACKAGE_ID;

  if (!packageId) {
    throw new Error(
      'VITE_SUI_PACKAGE_ID not configured. Set it in .env to the deployed package ID.'
    );
  }

  const budgetMist = BigInt(
    Math.max(Math.round(params.totalBudgetSui * MIST_PER_SUI), 1_000_000)
  );
  const bidMist = BigInt(
    Math.max(Math.round(params.bidSui * MIST_PER_SUI), 1_000)
  );

  const now = Date.now();
  const startAtMs = params.startAt ? params.startAt.getTime() : now;
  const endAtMs = params.endAt
    ? params.endAt.getTime()
    : now + 30 * 24 * 60 * 60 * 1000; // 30 days default
  const lockDurationMs = params.lockDurationMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days default

  const tx = new Transaction();

  // Split budget coin from gas
  const [budgetCoin] = tx.splitCoins(tx.gas, [budgetMist]);

  tx.moveCall({
    target: `${packageId}::ad_campaigns::create_campaign_entry`,
    arguments: [
      budgetCoin,                                                       // payment: Coin<SUI>
      tx.pure.vector('u8', toBytes(params.title)),                      // title: vector<u8>
      tx.pure.vector('u8', toBytes(params.description)),                // description: vector<u8>
      tx.pure.vector('u8', toBytes(params.targetUrl)),                  // target_url: vector<u8>
      tx.pure(vecOfVecU8Bcs(params.placements)),                        // placements: vector<vector<u8>>
      tx.pure.u64(bidMist),                                             // bid: u64
      tx.pure.u64(startAtMs),                                           // start_at: u64
      tx.pure.u64(endAtMs),                                             // end_at: u64
      tx.pure(vecOfVecU8Bcs(params.userZones || [])),                   // user_zones: vector<vector<u8>>
      tx.pure(vecOfVecU8Bcs(params.contentZones || [])),                // content_zones: vector<vector<u8>>
      tx.pure(bcs.option(bcs.u8()).serialize(null).toBytes()),          // planet: Option<u8> (None for Earth)
      tx.pure.u64(lockDurationMs),                                      // lock_duration_ms: u64
      tx.object(CLOCK_OBJECT_ID),                                       // clock: &Clock
    ],
  });

  tx.setSender(params.sender);
  tx.setGasBudget(50_000_000); // 0.05 SUI gas budget

  return tx;
}

/**
 * Check if on-chain campaign creation is configured.
 */
export function isOnChainCampaignAvailable(): boolean {
  return !!PACKAGE_ID;
}

/**
 * Convert SUI to MIST.
 */
export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * MIST_PER_SUI));
}
