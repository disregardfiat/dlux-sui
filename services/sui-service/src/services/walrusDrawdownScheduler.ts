import axios from 'axios';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import { suiClient } from '../sui/client';
import { logger } from '../utils/logger';
import { dappRepository } from '../repositories/dappRepository';

const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const PM_SERVICE_URL = process.env.PM_SERVICE_URL || 'http://localhost:3004';
const FOUNDATION_ADDRESS = process.env.FOUNDATION_ADDRESS || '';
const PM_POOL_ADDRESS = process.env.PM_POOL_ADDRESS || '';
const WALRUS_PROVIDER_ADDRESS = process.env.WALRUS_PROVIDER_ADDRESS || '';

interface PendingDrawdown {
  contentId: string;
  proofHashes: string[];
  impressions: Array<{
    proofHash: string;
    contentId: string;
    verified: boolean;
  }>;
}

interface DrawdownBatch {
  recipient: string;
  amount: bigint;
  drawdowns: Array<{
    contentId: string;
    proofHash: string;
    share: bigint;
  }>;
}

/**
 * Scheduled service for processing Walrus drawdowns off-chain
 * Batches multiple drawdowns into efficient SUI transfers
 */
export class WalrusDrawdownScheduler {
  private isProcessing = false;
  private serviceKeypair: Ed25519Keypair | null = null;

  constructor() {
    this.initializeKeypair();
  }

  private initializeKeypair(): void {
    const privateKey = process.env.WALRUS_DRAWDOWN_SERVICE_PRIVATE_KEY || 
                      process.env.ADMIN_PRIVATE_KEY || 
                      process.env.ADMIN_KEY_B64;
    
    if (!privateKey) {
      logger.warn('No service keypair configured for Walrus drawdown scheduler');
      return;
    }

    try {
      if (privateKey.startsWith('suiprivkey1')) {
        // Bech32-encoded SUI private key
        this.serviceKeypair = Ed25519Keypair.fromSecretKey(privateKey);
      } else if (privateKey.includes('=')) {
        // Base64 encoded
        const keyBytes = fromB64(privateKey);
        this.serviceKeypair = Ed25519Keypair.fromSecretKey(keyBytes);
      } else {
        // Hex or raw string
        this.serviceKeypair = Ed25519Keypair.fromSecretKey(
          Uint8Array.from(Buffer.from(privateKey, 'hex'))
        );
      }
      logger.info('Walrus drawdown scheduler keypair initialized');
    } catch (error) {
      logger.error('Failed to initialize service keypair', error);
    }
  }

  /**
   * Process all pending drawdowns in batches
   */
  async processPendingDrawdowns(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Drawdown processing already in progress, skipping');
      return;
    }

    if (!this.serviceKeypair) {
      logger.warn('Service keypair not configured, skipping drawdown processing');
      return;
    }

    this.isProcessing = true;

    try {
      // Get pending drawdowns from DGraph
      const response = await axios.get(`${DGRAPH_SERVICE_URL}/impressions/pending-drawdowns`, {
        timeout: 10000
      });

      const pending: PendingDrawdown[] = response.data.pending || [];
      
      if (pending.length === 0) {
        logger.debug('No pending drawdowns to process');
        return;
      }

      logger.info('Processing pending drawdowns', { count: pending.length });

      // Process each contentId's drawdowns
      const allBatches: DrawdownBatch[] = [];
      
      for (const drawdown of pending) {
        try {
          // Get content creator address
          const dapp = await dappRepository.findById(drawdown.contentId);
          if (!dapp) {
            logger.warn('Content not found, skipping drawdown', { contentId: drawdown.contentId });
            continue;
          }

          // Check PM status
          let pmActive = false;
          try {
            const pmResponse = await axios.get(
              `${PM_SERVICE_URL}/markets/dapp/${drawdown.contentId}`,
              { timeout: 5000 }
            );
            const markets = pmResponse.data?.markets || [];
            pmActive = markets.some((m: any) => m.status === 'open');
            
            const pmPassed = markets.some((m: any) => 
              m.status === 'resolved' && m.resolution === 'safe'
            );
            
            if (pmPassed && !pmActive) {
              pmActive = false; // Use creator instead
            }
          } catch (pmError) {
            logger.debug('PM check failed, defaulting to creator', {
              contentId: drawdown.contentId,
              error: pmError instanceof Error ? pmError.message : String(pmError)
            });
          }

          // For each proof, calculate amount (we'll need to get amount from somewhere)
          // For now, we'll use a default amount or calculate from proof data
          // In production, amount should come from the queue request
          const amountPerProof = BigInt(1000000000); // 1 SUI default - should be configurable

          // Calculate splits
          const walrusShare = amountPerProof * BigInt(10) / BigInt(100); // 10%
          const remainder = amountPerProof - walrusShare; // 90%
          const foundationShare = remainder * BigInt(10) / BigInt(100); // 9% of total
          const recipientShare = remainder - foundationShare; // 81% of total

          const recipient = pmActive ? PM_POOL_ADDRESS : dapp.owner;

          // Add to batches
          this.addToBatch(allBatches, WALRUS_PROVIDER_ADDRESS, {
            contentId: drawdown.contentId,
            proofHash: drawdown.proofHashes[0], // Representative
            share: walrusShare * BigInt(drawdown.proofHashes.length)
          });

          this.addToBatch(allBatches, FOUNDATION_ADDRESS, {
            contentId: drawdown.contentId,
            proofHash: drawdown.proofHashes[0],
            share: foundationShare * BigInt(drawdown.proofHashes.length)
          });

          this.addToBatch(allBatches, recipient, {
            contentId: drawdown.contentId,
            proofHash: drawdown.proofHashes[0],
            share: recipientShare * BigInt(drawdown.proofHashes.length)
          });

        } catch (error) {
          logger.error('Error processing drawdown for content', {
            contentId: drawdown.contentId,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with other drawdowns
        }
      }

      // Execute batch transfers
      const allProofHashes: string[] = [];
      for (const batch of allBatches) {
        if (batch.amount <= 0n) continue;

        try {
          await this.transferToRecipient(batch.recipient, batch.amount, batch.drawdowns);
          
          // Collect proof hashes for marking as completed
          for (const drawdown of batch.drawdowns) {
            const originalDrawdown = pending.find(p => p.contentId === drawdown.contentId);
            if (originalDrawdown) {
              allProofHashes.push(...originalDrawdown.proofHashes);
            }
          }
        } catch (error) {
          logger.error('Error executing batch transfer', {
            recipient: batch.recipient,
            amount: batch.amount.toString(),
            error: error instanceof Error ? error.message : String(error)
          });
          // Don't mark as completed if transfer failed
        }
      }

      // Mark proofs as completed (deduplicate)
      const uniqueProofHashes = [...new Set(allProofHashes)];
      if (uniqueProofHashes.length > 0) {
        try {
          await axios.post(
            `${DGRAPH_SERVICE_URL}/impressions/mark-walrus-drawdown-used`,
            { proofHashes: uniqueProofHashes },
            { timeout: 10000 }
          );
          logger.info('Marked drawdowns as completed', {
            proofCount: uniqueProofHashes.length
          });
        } catch (markError) {
          logger.error('Failed to mark drawdowns as completed', {
            error: markError instanceof Error ? markError.message : String(markError)
          });
        }
      }

      logger.info('Completed processing pending drawdowns', {
        processed: pending.length,
        batches: allBatches.length
      });

    } catch (error) {
      logger.error('Error processing pending drawdowns', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  private addToBatch(
    batches: DrawdownBatch[],
    recipient: string,
    drawdown: { contentId: string; proofHash: string; share: bigint }
  ): void {
    let batch = batches.find(b => b.recipient === recipient);
    if (!batch) {
      batch = { recipient, amount: 0n, drawdowns: [] };
      batches.push(batch);
    }
    batch.amount += drawdown.share;
    batch.drawdowns.push(drawdown);
  }

  private async transferToRecipient(
    recipient: string,
    totalAmount: bigint,
    drawdowns: Array<{ contentId: string; proofHash: string; share: bigint }>
  ): Promise<void> {
    if (!this.serviceKeypair) {
      throw new Error('Service keypair not initialized');
    }

    const client = suiClient.getClient();
    const tx = new Transaction();

    // Split from gas coin
    const [coin] = tx.splitCoins(tx.gas, [totalAmount]);
    tx.transferObjects([coin], recipient);

    const result = await client.signAndExecuteTransaction({
      signer: this.serviceKeypair,
      transaction: tx,
      options: { showEffects: true }
    });

    logger.info('Batch transfer completed', {
      recipient,
      amount: totalAmount.toString(),
      drawdownCount: drawdowns.length,
      txDigest: result.digest
    });
  }

  /**
   * Start the scheduler with specified interval
   */
  start(intervalMs: number = 3600000): void {
    // Run immediately on start
    this.processPendingDrawdowns().catch(err => {
      logger.error('Error in initial drawdown processing', err);
    });

    // Then run on interval
    setInterval(async () => {
      try {
        await this.processPendingDrawdowns();
      } catch (error) {
        logger.error('Error in scheduled drawdown processing', error);
      }
    }, intervalMs);

    logger.info('Walrus drawdown scheduler started', { intervalMs });
  }
}

export const walrusDrawdownScheduler = new WalrusDrawdownScheduler();
