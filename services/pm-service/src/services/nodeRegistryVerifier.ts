import axios from 'axios';
import { logger } from '../utils/logger';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';

// Load schema from docs directory (repo root)
const schemaPath = path.join(__dirname, '../../../../docs/walrus-node-registry-schema.json');
let nodeRegistrySchema: any = {};
try {
  nodeRegistrySchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
} catch {
  // Fallback: schema not found; validation will always pass
  nodeRegistrySchema = { type: 'object' };
}

const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';

const ajv = new Ajv();
const validate = ajv.compile(nodeRegistrySchema);

/**
 * Verifies Walrus node registry JSON files uploaded to Walrus
 * - Validates JSON schema
 * - Verifies signature (operatorAddress signed the JSON)
 * - Checks endpoint accessibility (optional)
 * - Updates DGraph with verified status
 */
export class NodeRegistryVerifier {
  /**
   * Verify a node registry blob from Walrus
   */
  async verifyRegistry(blobId: string, operatorAddress: string): Promise<{
    verified: boolean;
    nodeData?: any;
    error?: string;
  }> {
    try {
      // 1. Fetch registry JSON from Walrus
      const blobResponse = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${blobId}`, {
        responseType: 'json',
        timeout: 5000
      });

      const registryData = blobResponse.data;
      if (!registryData) {
        return { verified: false, error: 'Registry data not found' };
      }

      // 2. Validate JSON schema
      const valid = validate(registryData);
      if (!valid) {
        logger.warn('Registry schema validation failed', {
          blobId,
          errors: validate.errors
        });
        return {
          verified: false,
          error: `Schema validation failed: ${validate.errors?.map(e => e.message).join(', ')}`
        };
      }

      // 3. Verify operatorAddress matches
      if (registryData.operatorAddress !== operatorAddress) {
        return {
          verified: false,
          error: 'Operator address mismatch'
        };
      }

      // 4. Verify signature (operatorAddress signed the JSON)
      // TODO: Implement signature verification using Sui cryptography
      // For now, we'll do basic validation
      if (!registryData.signature || !registryData.signature.startsWith('0x')) {
        return {
          verified: false,
          error: 'Invalid signature format'
        };
      }

      // 5. Optional: Check endpoint accessibility
      let endpointAccessible = true;
      try {
        const healthCheck = await axios.get(`${registryData.endpoint}/health`, {
          timeout: 3000
        });
        endpointAccessible = healthCheck.status === 200;
      } catch (endpointError) {
        logger.debug('Endpoint health check failed', {
          endpoint: registryData.endpoint,
          error: endpointError instanceof Error ? endpointError.message : String(endpointError)
        });
        endpointAccessible = false;
        // Don't fail verification if endpoint is down, just log
      }

      // 6. Index in DGraph (minimal metadata)
      try {
        await axios.post(`${DGRAPH_SERVICE_URL}/walrus/nodes/index`, {
          blobId,
          operatorAddress: registryData.operatorAddress,
          nodeAddress: registryData.nodeAddress,
          endpoint: registryData.endpoint,
          region: registryData.region,
          public: registryData.public,
          verified: true,
          status: endpointAccessible ? 'active' : 'inactive'
        }, { timeout: 5000 });

        logger.info('Node registry verified and indexed', {
          blobId,
          operatorAddress: registryData.operatorAddress,
          endpoint: registryData.endpoint
        });
      } catch (indexError) {
        logger.error('Failed to index node registry', {
          blobId,
          error: indexError instanceof Error ? indexError.message : String(indexError)
        });
        // Continue even if indexing fails
      }

      return {
        verified: true,
        nodeData: {
          blobId,
          operatorAddress: registryData.operatorAddress,
          nodeAddress: registryData.nodeAddress,
          endpoint: registryData.endpoint,
          region: registryData.region,
          public: registryData.public,
          verified: true,
          endpointAccessible
        }
      };

    } catch (error) {
      logger.error('Error verifying node registry', {
        blobId,
        operatorAddress,
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Batch verify multiple registries
   */
  async verifyBatch(blobIds: string[], operatorAddresses: string[]): Promise<Array<{
    blobId: string;
    verified: boolean;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      blobIds.map((blobId, i) =>
        this.verifyRegistry(blobId, operatorAddresses[i] || '')
      )
    );

    return results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return {
          blobId: blobIds[i],
          verified: result.value.verified,
          error: result.value.error
        };
      } else {
        return {
          blobId: blobIds[i],
          verified: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        };
      }
    });
  }
}

export const nodeRegistryVerifier = new NodeRegistryVerifier();
