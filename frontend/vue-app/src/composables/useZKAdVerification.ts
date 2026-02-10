import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

import { getDgraphServiceUrl, getZKServiceUrl } from '@/config/links';
const ZK_SERVICE = getZKServiceUrl();
const DGRAPH_SERVICE = getDgraphServiceUrl();

export interface ZKProofResult {
  proof: any;
  publicSignals: string[];
  proofHash: string;
  encryptedViewer: string;
}

/**
 * Composable for ZK ad verification
 * Generates zero-knowledge proofs for ad views without revealing viewer identity
 */
export function useZKAdVerification() {
  const authStore = useAuthStore();
  const isGenerating = ref(false);
  const error = ref<string | null>(null);

  /**
   * Fetch current Sui block header
   */
  async function fetchBlockHeader(): Promise<string> {
    try {
      const response = await fetch(`${DGRAPH_SERVICE}/blocks/latest`);
      if (!response.ok) {
        throw new Error('Failed to fetch block header');
      }
      const data = await response.json();
      return data?.latestBlock?.blockHash || String(data?.latestBlock?.blockNumber || Date.now());
    } catch (err) {
      // Fallback to timestamp if SUI service unavailable
      console.warn('Failed to fetch block header, using timestamp', err);
      return Date.now().toString();
    }
  }

  /**
   * Generate random salt (client-side, never sent to server)
   */
  function generateSecretSalt(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Hash proof for Merkle tree
   */
  async function hashProof(proof: any, publicSignals: string[]): Promise<string> {
    const proofString = JSON.stringify({ proof, publicSignals });
    const encoder = new TextEncoder();
    const data = encoder.encode(proofString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate ZK proof for ad view
   * @param adId Ad identifier
   * @param contentId Content identifier
   * @returns ZK proof result
   */
  async function generateAdViewProof(
    adId: string,
    contentId: string
  ): Promise<ZKProofResult> {
    isGenerating.value = true;
    error.value = null;

    try {
      // 1. Fetch current block header
      const blockHeader = await fetchBlockHeader();

      // 2. Generate random salt (client-side, never sent to server)
      const secretSalt = generateSecretSalt();

      // 3. Get viewer identity (SuiNS name or address)
      const viewerIdentity = authStore.user?.suinsName || authStore.user?.suiAddress;
      if (!viewerIdentity) {
        throw new Error('User not authenticated');
      }

      // 4. Generate ZK proof (identity used but NOT included in proof)
      const response = await fetch(`${ZK_SERVICE}/proofs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adId,
          viewerIdentity, // Used to generate proof but NOT in proof output
          contentId,
          blockHeader,
          secretSalt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate ZK proof');
      }

      const proofData = await response.json();

      // 5. Compute proof hash (for Merkle tree)
      const proofHash = await hashProof(proofData.proof, proofData.publicSignals);

      return {
        proof: proofData.proof,
        publicSignals: proofData.publicSignals,
        proofHash,
        encryptedViewer: proofData.encryptedViewer
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
      throw err;
    } finally {
      isGenerating.value = false;
    }
  }

  /**
   * Submit ad impression to DGraph
   * @param adId Ad identifier
   * @param contentId Content identifier
   * @param proofResult ZK proof result
   * @param blockHeader Block header
   */
  async function submitImpression(
    adId: string,
    contentId: string,
    proofResult: ZKProofResult,
    blockHeader: string
  ): Promise<void> {
    try {
      const response = await fetch(`${DGRAPH_SERVICE}/impressions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adId,
          contentId,
          zkProof: {
            proof: proofResult.proof,
            publicSignals: proofResult.publicSignals
          },
          proofHash: proofResult.proofHash,
          encryptedViewer: proofResult.encryptedViewer,
          blockHeader
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit impression');
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
      throw err;
    }
  }

  /**
   * Complete ad verification flow
   * Generates ZK proof and submits impression
   */
  async function verifyAdView(
    adId: string,
    contentId: string
  ): Promise<{ success: boolean; thresholdReached?: boolean }> {
    try {
      // Generate ZK proof
      const proofResult = await generateAdViewProof(adId, contentId);

      // Fetch block header
      const blockHeader = await fetchBlockHeader();

      // Submit impression
      const result = await submitImpression(adId, contentId, proofResult, blockHeader);

      return {
        success: true,
        thresholdReached: result.thresholdReached || false
      };
    } catch (err) {
      console.error('Ad verification failed', err);
      return { success: false };
    }
  }

  return {
    isGenerating,
    error,
    generateAdViewProof,
    submitImpression,
    verifyAdView
  };
}
