import { groth16 } from 'snarkjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { poseidon } from 'circomlib';

/**
 * ZK proof generator service
 * Generates zero-knowledge proofs for ad views without revealing viewer identity
 */
export class ZKProofGenerator {
  private wasmPath: string;
  private zkeyPath: string;
  private initialized = false;

  constructor() {
    this.wasmPath = process.env.CIRCUIT_WASM_PATH || join(__dirname, '../../circuits/ad-view-proof.wasm');
    this.zkeyPath = process.env.CIRCUIT_ZKEY_PATH || join(__dirname, '../../circuits/ad-view-proof.zkey');
  }

  /**
   * Initialize proof generator (check if circuit files exist)
   */
  async initialize(): Promise<void> {
    try {
      // Check if circuit files exist
      readFileSync(this.wasmPath);
      readFileSync(this.zkeyPath);
      this.initialized = true;
      logger.info('ZK proof generator initialized', {
        wasmPath: this.wasmPath,
        zkeyPath: this.zkeyPath
      });
    } catch (error) {
      logger.warn('Circuit files not found. Proof generation will fail until circuits are compiled.', {
        wasmPath: this.wasmPath,
        zkeyPath: this.zkeyPath,
        error: error instanceof Error ? error.message : String(error)
      });
      this.initialized = false;
    }
  }

  /**
   * Generate ZK proof for ad view
   * @param adId Ad identifier
   * @param viewerIdentity SuiNS name or address (used to generate proof but NOT included in proof)
   * @param contentId Content identifier
   * @param blockHeader Sui block header
   * @param secretSalt Random salt for privacy
   * @param merkleRoot Merkle root (will be set when tree is built)
   * @param threshold Threshold for verification (e.g., 100)
   * @returns ZK proof and public signals
   */
  async generateAdViewProof(
    adId: string,
    viewerIdentity: string,
    contentId: string,
    blockHeader: string,
    secretSalt: string,
    merkleRoot: string = '0',
    threshold: number = 100,
    actionType: 'view' | 'click' | 'conversion' = 'view'
  ): Promise<{
    proof: any;
    publicSignals: string[];
    proofHash: string;
  }> {
    if (!this.initialized) {
      throw new Error('Proof generator not initialized. Circuit files not found.');
    }

    try {
      // Convert inputs to field elements (using Poseidon hash for strings)
      const adIdField = this.hashToField(adId);
      const viewerIdentityField = this.hashToField(viewerIdentity);
      const contentIdField = this.hashToField(contentId);
      const blockHeaderField = this.hashToField(blockHeader);
      const secretSaltField = this.hashToField(secretSalt);
      const merkleRootField = this.hashToField(merkleRoot);
      const thresholdField = threshold.toString();
      const actionField = this.actionTypeToField(actionType);

      // Private inputs (witnesses - hidden from verifier)
      const privateInputs = {
        adId: adIdField,
        viewerIdentity: viewerIdentityField, // Used in proof generation but NOT in proof output
        contentId: contentIdField,
        blockHeader: blockHeaderField,
        secretSalt: secretSaltField,
        actionType: actionField
      };

      // Public inputs (known to verifier)
      const publicInputs = {
        merkleRoot: merkleRootField,
        threshold: thresholdField
      };

      // Generate proof using groth16
      logger.info('Generating ZK proof for ad view', {
        adId,
        contentId,
        actionType,
        hasViewerIdentity: !!viewerIdentity
      });

      const { proof, publicSignals } = await groth16.fullProve(
        { ...privateInputs, ...publicInputs },
        this.wasmPath,
        this.zkeyPath
      );

      // Compute proof hash (for Merkle tree)
      const proofHash = this.computeProofHash(proof, publicSignals);

      logger.info('ZK proof generated successfully', {
        proofHash: proofHash.substring(0, 16) + '...'
      });

      return {
        proof,
        publicSignals,
        proofHash
      };
    } catch (error) {
      logger.error('Failed to generate ZK proof', error);
      throw new Error(`Proof generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Verify ZK proof
   * @param proof ZK proof
   * @param publicSignals Public signals
   * @returns True if proof is valid
   */
  async verifyProof(proof: any, publicSignals: string[]): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Proof generator not initialized. Circuit files not found.');
    }

    try {
      const vkey = await this.loadVerificationKey();
      const isValid = await groth16.verify(vkey, publicSignals, proof);
      
      logger.info('ZK proof verification', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Failed to verify ZK proof', error);
      return false;
    }
  }

  /**
   * Compute proof hash for Merkle tree
   */
  private computeProofHash(proof: any, publicSignals: string[]): string {
    // Hash proof and public signals together
    const proofString = JSON.stringify({ proof, publicSignals });
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(proofString).digest('hex');
  }

  /**
   * Convert string to field element (using Poseidon hash)
   */
  private hashToField(input: string): string {
    // Use Poseidon hash for ZK-friendly hashing
    // Convert string to bytes
    const inputBytes = Buffer.from(input, 'utf8');
    
    // Pad to 32 bytes if needed
    const padded = Buffer.alloc(32);
    inputBytes.copy(padded, 0, 0, Math.min(inputBytes.length, 32));
    
    // Use Poseidon hash (simplified - in production use proper Poseidon)
    // For now, use SHA256 and convert to field element
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    
    // Convert hex to BigInt and then to string (field element)
    // Using first 16 hex chars to avoid overflow
    const fieldElement = BigInt('0x' + hash.substring(0, 16));
    return fieldElement.toString();
  }

  /**
   * Map action type to field element
   */
  private actionTypeToField(actionType: 'view' | 'click' | 'conversion'): string {
    switch (actionType) {
      case 'click':
        return '2';
      case 'conversion':
        return '3';
      case 'view':
      default:
        return '1';
    }
  }

  /**
   * Load verification key (vkey) for proof verification
   */
  private async loadVerificationKey(): Promise<any> {
    // In production, load vkey from file
    // For now, we'll generate it from zkey if needed
    // This is a placeholder - actual implementation depends on snarkjs API
    const vkeyPath = this.zkeyPath.replace('.zkey', '.vkey.json');
    try {
      const vkeyJson = readFileSync(vkeyPath, 'utf8');
      return JSON.parse(vkeyJson);
    } catch (error) {
      // If vkey doesn't exist, we'll need to extract it from zkey
      // This is handled by snarkjs internally
      logger.warn('Verification key file not found, using zkey directly');
      return null; // snarkjs will handle this
    }
  }
}

export const proofGenerator = new ZKProofGenerator();
