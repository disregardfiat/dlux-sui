import { createHash } from 'crypto';
import { impressionRepository, AdImpression } from '../repositories/impressionRepository';
import { logger } from '../utils/logger';

export interface MerkleProof {
  proofHash: string;
  path: string[];
  indices: number[];
}

export interface MerkleTreeResult {
  merkleRoot: string;
  proofs: MerkleProof[];
  leafCount: number;
}

/**
 * Merkle tree aggregator for privacy-preserving batch verification
 * Builds Merkle trees from ZK proof hashes (no identity revealed)
 */
export class MerkleAggregator {
  /**
   * Build Merkle tree from impressions for a content
   * @param contentId Content identifier
   * @param threshold Threshold for triggering aggregation (default: 100)
   * @returns Merkle tree root and proof paths, or null if threshold not met
   */
  async buildMerkleTree(
    contentId: string,
    threshold: number = 100
  ): Promise<MerkleTreeResult | null> {
    // Get all impressions for this content
    const impressions = await impressionRepository.findByContentId(contentId);
    const verifiedImpressions = impressions.filter(imp => imp.verified);

    if (verifiedImpressions.length < threshold) {
      logger.info('Threshold not met for Merkle tree', {
        contentId,
        currentCount: verifiedImpressions.length,
        totalCount: impressions.length,
        threshold
      });
      return null;
    }

    // Extract proof hashes (no identity revealed)
    const leaves = verifiedImpressions.map(imp => imp.proofHash);

    // Build Merkle tree
    const tree = this.buildTree(leaves);

    // Generate proof paths for each leaf
    const proofs: MerkleProof[] = verifiedImpressions.map((imp, index) => {
      const { path, indices } = this.getProofPath(tree, index);
      return {
        proofHash: imp.proofHash,
        path,
        indices
      };
    });

    // Update impressions with Merkle paths
    for (let i = 0; i < verifiedImpressions.length; i++) {
      const imp = verifiedImpressions[i];
      const proof = proofs[i];
      if (!imp.uid) {
        logger.warn('Missing uid for impression; skipping Merkle path update', { id: imp.id });
        continue;
      }
      await impressionRepository.updateMerklePath(imp.uid, JSON.stringify(proof.path), i);
    }

    logger.info('Merkle tree built', {
      contentId,
      leafCount: leaves.length,
      merkleRoot: tree.root.substring(0, 16) + '...'
    });

    return {
      merkleRoot: tree.root,
      proofs,
      leafCount: leaves.length
    };
  }

  /**
   * Build binary Merkle tree from leaves
   */
  private buildTree(leaves: string[]): { root: string; levels: string[][] } {
    if (leaves.length === 0) {
      throw new Error('Cannot build Merkle tree with empty leaves');
    }

    // Pad leaves to power of 2
    const paddedLeaves = this.padToPowerOfTwo(leaves);
    const levels: string[][] = [paddedLeaves];

    // Build tree bottom-up
    let currentLevel = paddedLeaves;
    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || left; // Use left if odd number
        const parent = this.hashPair(left, right);
        nextLevel.push(parent);
      }
      levels.push(nextLevel);
      currentLevel = nextLevel;
    }

    return {
      root: currentLevel[0],
      levels
    };
  }

  /**
   * Get Merkle proof path for a leaf
   */
  private getProofPath(
    tree: { root: string; levels: string[][] },
    leafIndex: number
  ): { path: string[]; indices: number[] } {
    const path: string[] = [];
    const indices: number[] = [];

    let currentIndex = leafIndex;
    let currentLevel = 0;

    // Traverse from leaf to root
    while (currentLevel < tree.levels.length - 1) {
      const level = tree.levels[currentLevel];
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;

      // Get sibling (or duplicate if odd number)
      const sibling = level[siblingIndex] || level[currentIndex];
      path.push(sibling);
      indices.push(siblingIndex % 2 === 0 ? 0 : 1); // 0 = left, 1 = right

      // Move to parent level
      currentIndex = Math.floor(currentIndex / 2);
      currentLevel++;
    }

    return { path, indices };
  }

  /**
   * Pad array to next power of 2
   */
  private padToPowerOfTwo(arr: string[]): string[] {
    const length = arr.length;
    const nextPower = Math.pow(2, Math.ceil(Math.log2(length)));
    
    if (length === nextPower) {
      return arr;
    }

    // Pad with duplicate of last element
    const padded = [...arr];
    const lastElement = arr[arr.length - 1];
    while (padded.length < nextPower) {
      padded.push(lastElement);
    }

    return padded;
  }

  /**
   * Hash a pair of nodes
   */
  private hashPair(left: string, right: string): string {
    const combined = left + right;
    return createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Verify Merkle proof
   */
  verifyProof(
    leaf: string,
    path: string[],
    indices: number[],
    root: string
  ): boolean {
    let currentHash = leaf;

    for (let i = 0; i < path.length; i++) {
      const sibling = path[i];
      const isRight = indices[i] === 1;

      if (isRight) {
        // Current is left, sibling is right
        currentHash = this.hashPair(currentHash, sibling);
      } else {
        // Current is right, sibling is left
        currentHash = this.hashPair(sibling, currentHash);
      }
    }

    return currentHash === root;
  }
}

export const merkleAggregator = new MerkleAggregator();
