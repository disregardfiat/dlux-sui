/**
 * Composable for building SUI transfer transactions.
 * Used for subscription payments, premium content purchases, etc.
 * Supports testnet with low prices.
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const MIST_PER_SUI = 1_000_000_000;

const DEFAULT_RPC =
  import.meta.env.VITE_SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443';

let clientInstance: SuiClient | null = null;

function getClient(): SuiClient {
  if (!clientInstance) {
    clientInstance = new SuiClient({ url: DEFAULT_RPC });
  }
  return clientInstance;
}

/**
 * Build a SUI transfer transaction (split from gas, transfer to recipient).
 * Returns serialized bytes ready for wallet signAndExecuteTransactionBlock.
 *
 * @param sender - Address sending SUI
 * @param recipient - Address receiving SUI
 * @param amountSui - Amount in SUI (e.g. 0.01 for testnet)
 */
export async function buildSuiTransferTransaction(
  sender: string,
  recipient: string,
  amountSui: number
): Promise<Uint8Array> {
  const amountMist = BigInt(Math.round(amountSui * MIST_PER_SUI));
  if (amountMist <= 0n) {
    throw new Error('Transfer amount must be positive');
  }

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [amountMist]);
  tx.transferObjects([coin], recipient);
  tx.setSender(sender);

  const client = getClient();
  return await tx.build({ client });
}

/**
 * Convert SUI to MIST (1 SUI = 1e9 MIST)
 */
export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * MIST_PER_SUI));
}
