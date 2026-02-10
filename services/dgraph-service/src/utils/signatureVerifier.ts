/**
 * Signature verification utility
 * Verifies SUI signatures but does NOT broadcast to blockchain
 */

import { verifyPersonalMessageSignature } from '@mysten/sui/verify';

export class SignatureVerifier {
  /**
   * Verify a SUI personal message signature
   * @param address SUI address (expected signer)
   * @param message Original message string
   * @param signature Serialized SUI signature (base64)
   */
  static async verifySignature(
    address: string,
    message: string,
    signature: string
  ): Promise<boolean> {
    try {
      if (!signature || signature.length < 10) {
        return false;
      }

      const messageBytes = new TextEncoder().encode(message);
      await verifyPersonalMessageSignature(messageBytes, signature, { address });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a deterministic signable message for social actions.
   * Keys sorted so client and server produce identical message for verification.
   */
  static createSignableMessage(
    action: string,
    data: Record<string, unknown>
  ): string {
    const messageData: Record<string, unknown> = { action, ...data };
    const keys = Object.keys(messageData).filter((k) => messageData[k] !== undefined).sort();
    const sorted: Record<string, unknown> = {};
    for (const k of keys) sorted[k] = messageData[k];
    return JSON.stringify(sorted);
  }
}
