import { logger } from '../utils/logger';
import { dgraphClient } from '../dgraph/client';
import { walrusService } from './walrusService';
import crypto from 'crypto';

export interface SocialBlock {
  id: string;
  blockNumber: number;
  previousBlockHash: string;
  timestamp: Date;
  interactions: SocialInteraction[];
  blockHash: string;
  walrusId?: string; // Walrus blob ID for broadcasting
  signatures: BlockSignature[]; // Proofs from ecosystem participants
}

export interface SocialInteraction {
  id: string;
  type: 'post' | 'interaction' | 'follow';
  author: string;
  data: any;
  signature: string;
  timestamp: Date;
  sequence: number; // Global ordering sequence
}

export interface BlockSignature {
  signer: string; // Ecosystem participant who signed
  signature: string;
  timestamp: Date;
  ecosystemId: string; // Which ecosystem this signature is from
}

export interface EcosystemPeer {
  id: string;
  name: string;
  dgraphEndpoint: string;
  publicKey: string;
  lastSeenBlock: number;
}

/**
 * Social Blockchain Service
 *
 * Creates ordered blocks of social interactions that can be:
 * - Broadcast via Walrus for ecosystem replication
 * - Cryptographically verified for provenance
 * - Shared across federated DGraph instances
 * - Ordered consistently across the network
 */
export class SocialBlockchainService {
  private currentBlock: SocialBlock | null = null;
  private blockSize = 100; // Interactions per block
  private peers: Map<string, EcosystemPeer> = new Map();

  /**
   * Initialize the social blockchain
   */
  async initialize(): Promise<void> {
    await this.loadPeers();
    await this.loadLatestBlock();
    logger.info('Social blockchain initialized', { latestBlock: this.currentBlock?.blockNumber });
  }

  /**
   * Add a social interaction to the current block
   */
  async addInteraction(interaction: Omit<SocialInteraction, 'sequence'>): Promise<void> {
    const sequence = await this.getNextSequence();

    const fullInteraction: SocialInteraction = {
      ...interaction,
      sequence
    };

    // Initialize block if needed
    if (!this.currentBlock || this.currentBlock.interactions.length >= this.blockSize) {
      await this.createNewBlock();
    }

    // Add interaction to current block
    this.currentBlock!.interactions.push(fullInteraction);

    // Check if block is full
    if (this.currentBlock!.interactions.length >= this.blockSize) {
      await this.finalizeAndBroadcastBlock();
    }

    logger.debug('Interaction added to block', {
      interactionId: interaction.id,
      blockNumber: this.currentBlock?.blockNumber,
      sequence
    });
  }

  /**
   * Create a new block
   */
  private async createNewBlock(): Promise<void> {
    const blockNumber = (this.currentBlock?.blockNumber || 0) + 1;
    const previousBlockHash = this.currentBlock?.blockHash || 'genesis';

    this.currentBlock = {
      id: `block_${blockNumber}`,
      blockNumber,
      previousBlockHash,
      timestamp: new Date(),
      interactions: [],
      blockHash: '',
      signatures: []
    };

    logger.info('New social block created', { blockNumber });
  }

  /**
   * Finalize and broadcast the current block
   */
  private async finalizeAndBroadcastBlock(): Promise<void> {
    if (!this.currentBlock || this.currentBlock.interactions.length === 0) {
      return;
    }

    // Calculate block hash
    this.currentBlock.blockHash = this.calculateBlockHash(this.currentBlock);

    // Store block in DGraph
    await this.storeBlock(this.currentBlock);

    // Broadcast via Walrus
    await this.broadcastBlock(this.currentBlock);

    // Request signatures from ecosystem peers
    await this.requestSignatures(this.currentBlock);

    logger.info('Block finalized and broadcast', {
      blockNumber: this.currentBlock.blockNumber,
      interactionCount: this.currentBlock.interactions.length,
      blockHash: this.currentBlock.blockHash
    });

    // Reset for next block
    this.currentBlock = null;
  }

  /**
   * Calculate cryptographic hash of a block
   */
  private calculateBlockHash(block: SocialBlock): string {
    const blockData = {
      blockNumber: block.blockNumber,
      previousBlockHash: block.previousBlockHash,
      timestamp: block.timestamp.toISOString(),
      interactions: block.interactions.map(i => ({
        id: i.id,
        type: i.type,
        author: i.author,
        data: i.data,
        signature: i.signature,
        timestamp: i.timestamp.toISOString(),
        sequence: i.sequence
      }))
    };

    const hashData = JSON.stringify(blockData, Object.keys(blockData).sort());
    return crypto.createHash('sha256').update(hashData).digest('hex');
  }

  /**
   * Store block in DGraph
   */
  private async storeBlock(block: SocialBlock): Promise<void> {
    const mutation = {
      set: {
        uid: `_:${block.id}`,
        dgraph_type: 'SocialBlock',
        id: block.id,
        blockNumber: block.blockNumber,
        previousBlockHash: block.previousBlockHash,
        timestamp: block.timestamp.toISOString(),
        blockHash: block.blockHash,
        walrusId: block.walrusId,
        interactions: block.interactions.map(interaction => ({
          dgraph_type: 'SocialInteraction',
          id: interaction.id,
          type: interaction.type,
          author: interaction.author,
          data: interaction.data,
          signature: interaction.signature,
          timestamp: interaction.timestamp.toISOString(),
          sequence: interaction.sequence
        }))
      }
    };

    await dgraphClient.mutate(mutation);
  }

  /**
   * Broadcast block via Walrus
   */
  private async broadcastBlock(block: SocialBlock): Promise<void> {
    try {
      const blockData = JSON.stringify(block);
      const blobId = await walrusService.uploadBlob(
        Buffer.from(blockData),
        'application/json',
        `social-block-${block.blockNumber}`
      );

      block.walrusId = blobId;

      // Update block with Walrus ID
      await this.updateBlockWalrusId(block.id, blobId);

      logger.info('Block broadcast via Walrus', {
        blockNumber: block.blockNumber,
        walrusId: blobId
      });
    } catch (error) {
      logger.error('Failed to broadcast block via Walrus', error);
    }
  }

  /**
   * Request signatures from ecosystem peers
   */
  private async requestSignatures(block: SocialBlock): Promise<void> {
    const signatureRequests = Array.from(this.peers.values()).map(async (peer) => {
      try {
        // In a real implementation, this would make HTTP requests to peer endpoints
        // For now, we'll simulate peer signatures
        const signature = await this.requestPeerSignature(peer, block);
        if (signature) {
          block.signatures.push(signature);
          await this.storeBlockSignature(block.id, signature);
        }
      } catch (error) {
        logger.warn('Failed to get signature from peer', { peerId: peer.id, error });
      }
    });

    await Promise.all(signatureRequests);

    logger.info('Block signatures collected', {
      blockNumber: block.blockNumber,
      signatureCount: block.signatures.length
    });
  }

  /**
   * Request signature from a specific peer (simplified)
   */
  private async requestPeerSignature(peer: EcosystemPeer, block: SocialBlock): Promise<BlockSignature | null> {
    // In a real implementation, this would:
    // 1. Send block hash to peer endpoint
    // 2. Peer verifies block contents
    // 3. Peer signs the block hash
    // 4. Return signature

    // For simulation, create a mock signature
    const signature: BlockSignature = {
      signer: peer.id,
      signature: `sig_${crypto.randomBytes(32).toString('hex')}`,
      timestamp: new Date(),
      ecosystemId: peer.id
    };

    return signature;
  }

  /**
   * Verify block provenance using signatures
   */
  async verifyBlockProvenance(blockId: string): Promise<boolean> {
    const block = await this.getBlockById(blockId);
    if (!block) return false;

    // Verify block hash integrity
    const calculatedHash = this.calculateBlockHash(block);
    if (calculatedHash !== block.blockHash) {
      return false;
    }

    // Verify signatures from known peers
    for (const signature of block.signatures) {
      const peer = this.peers.get(signature.ecosystemId);
      if (!peer) continue;

      // Verify signature (simplified)
      const isValid = await this.verifySignature(peer.publicKey, block.blockHash, signature.signature);
      if (!isValid) {
        logger.warn('Invalid signature on block', {
          blockId,
          signer: signature.signer
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Load ecosystem peers from configuration
   */
  private async loadPeers(): Promise<void> {
    // In a real implementation, this would load from a configuration file
    // or discover peers through a decentralized registry

    const mockPeers: EcosystemPeer[] = [
      {
        id: 'dlux-sui',
        name: 'DLUX-SUI Main',
        dgraphEndpoint: 'http://localhost:3003',
        publicKey: 'mock_public_key_main',
        lastSeenBlock: 0
      }
      // Add other ecosystem peers here
    ];

    mockPeers.forEach(peer => this.peers.set(peer.id, peer));
    logger.info('Ecosystem peers loaded', { peerCount: this.peers.size });
  }

  /**
   * Load the latest block from DGraph
   */
  private async loadLatestBlock(): Promise<void> {
    const query = `
      query latestBlock {
        blocks(func: type(SocialBlock), orderdesc: blockNumber, first: 1) {
          id
          blockNumber
          previousBlockHash
          timestamp
          blockHash
          walrusId
          interactions {
            id
            type
            author
            data
            signature
            timestamp
            sequence
          }
          signatures {
            signer
            signature
            timestamp
            ecosystemId
          }
        }
      }
    `;

    const result = await dgraphClient.query(query);
    const latestBlock = result.blocks?.[0];

    if (latestBlock) {
      this.currentBlock = {
        ...latestBlock,
        timestamp: new Date(latestBlock.timestamp),
        interactions: latestBlock.interactions.map((i: any) => ({
          ...i,
          timestamp: new Date(i.timestamp)
        })),
        signatures: latestBlock.signatures.map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp)
        }))
      };
    }
  }

  /**
   * Get next sequence number for interactions
   */
  private inMemorySequence = 0;

  private async getNextSequence(): Promise<number> {
    try {
      const query = `
        query maxSequence {
          interactions(func: type(SocialInteraction), orderdesc: sequence, first: 1) {
            sequence
          }
        }
      `;
      const result = await dgraphClient.query(query);
      const maxSequence = result.interactions?.[0]?.sequence || 0;
      return maxSequence + 1;
    } catch {
      this.inMemorySequence += 1;
      return this.inMemorySequence;
    }
  }

  // Helper methods
  private async updateBlockWalrusId(blockId: string, walrusId: string): Promise<void> {
    const mutation = {
      set: {
        uid: blockId,
        walrusId
      }
    };
    await dgraphClient.mutate(mutation);
  }

  private async storeBlockSignature(blockId: string, signature: BlockSignature): Promise<void> {
    const mutation = {
      set: {
        uid: blockId,
        signatures: {
          dgraph_type: 'BlockSignature',
          signer: signature.signer,
          signature: signature.signature,
          timestamp: signature.timestamp.toISOString(),
          ecosystemId: signature.ecosystemId
        }
      }
    };
    await dgraphClient.mutate(mutation);
  }

  private async getBlockById(blockId: string): Promise<SocialBlock | null> {
    const query = `
      query block($id: string) {
        block(func: eq(id, $id)) @filter(type(SocialBlock)) {
          id
          blockNumber
          previousBlockHash
          timestamp
          blockHash
          walrusId
          interactions {
            id
            type
            author
            data
            signature
            timestamp
            sequence
          }
          signatures {
            signer
            signature
            timestamp
            ecosystemId
          }
        }
      }
    `;

    const result = await dgraphClient.query(query, { $id: blockId });
    const block = result.block?.[0];

    if (!block) return null;

    return {
      ...block,
      timestamp: new Date(block.timestamp),
      interactions: block.interactions.map((i: any) => ({
        ...i,
        timestamp: new Date(i.timestamp)
      })),
      signatures: block.signatures.map((s: any) => ({
        ...s,
        timestamp: new Date(s.timestamp)
      }))
    };
  }

  private async verifySignature(publicKey: string, message: string, signature: string): Promise<boolean> {
    // In a real implementation, this would verify cryptographic signatures
    // For now, return true for simulation
    return true;
  }
}

export const socialBlockchain = new SocialBlockchainService();