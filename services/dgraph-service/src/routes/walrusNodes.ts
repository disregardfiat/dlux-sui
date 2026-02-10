import express from 'express';
import { dgraphClient } from '../dgraph/client';
import { logger } from '../utils/logger';

const router = express.Router();

export interface WalrusNode {
  uid?: string;
  blobId: string;
  operatorAddress: string;
  nodeAddress: string;
  endpoint: string;
  region: string;
  public: boolean;
  verified: boolean;
  verifiedAt?: Date;
  status: string;
  reputation: number;
  registeredAt: Date;
  lastSeen?: Date;
}

/**
 * POST /walrus/nodes/index
 * Index a verified Walrus node registry (minimal metadata)
 */
router.post('/index', async (req, res) => {
  try {
    const {
      blobId,
      operatorAddress,
      nodeAddress,
      endpoint,
      region,
      public: isPublic,
      verified,
      status
    } = req.body;

    if (!blobId || !operatorAddress || !nodeAddress || !endpoint) {
      return res.status(400).json({
        error: 'Missing required fields: blobId, operatorAddress, nodeAddress, endpoint'
      });
    }

    const now = new Date();
    const mutation = {
      set: {
        uid: `_:node_${blobId}`,
        dgraph_type: 'WalrusNode',
        blobId,
        operatorAddress,
        nodeAddress,
        endpoint,
        region: region || 'unknown',
        public: isPublic ?? true,
        verified: verified ?? false,
        verifiedAt: verified ? now.toISOString() : undefined,
        status: status || 'active',
        reputation: 0.5, // Default reputation
        registeredAt: now.toISOString(),
        lastSeen: now.toISOString()
      }
    };

    try {
      await dgraphClient.mutate(mutation);
      logger.info('Indexed Walrus node', { blobId, operatorAddress, endpoint });
      res.json({ success: true, blobId });
    } catch (error) {
      logger.error('Failed to index Walrus node', { blobId, error });
      res.status(500).json({ error: 'Failed to index node' });
    }
  } catch (error) {
    logger.error('Error indexing Walrus node', error);
    res.status(500).json({ error: 'Failed to index node' });
  }
});

/**
 * GET /walrus/nodes
 * Get indexed Walrus nodes (for discovery)
 */
router.get('/', async (req, res) => {
  try {
    const { region, public: isPublic, status, verified } = req.query;

    let filters = '@filter(type(WalrusNode))';
    if (region) filters += ` AND eq(region, "${region}")`;
    if (isPublic !== undefined) filters += ` AND eq(public, ${isPublic === 'true'})`;
    if (status) filters += ` AND eq(status, "${status}")`;
    if (verified !== undefined) filters += ` AND eq(verified, ${verified === 'true'})`;

    const query = `
      query nodes {
        nodes(func: type(WalrusNode)) ${filters} {
          uid
          blobId
          operatorAddress
          nodeAddress
          endpoint
          region
          public
          verified
          verifiedAt
          status
          reputation
          registeredAt
          lastSeen
        }
      }
    `;

    try {
      const result = await dgraphClient.query(query);
      const nodes = (result.nodes || []).map((node: any) => ({
        blobId: node.blobId,
        operatorAddress: node.operatorAddress,
        nodeAddress: node.nodeAddress,
        endpoint: node.endpoint,
        region: node.region,
        public: node.public,
        verified: node.verified,
        status: node.status,
        reputation: node.reputation || 0,
        registeredAt: node.registeredAt,
        lastSeen: node.lastSeen
      }));

      res.json({ nodes, count: nodes.length });
    } catch (error) {
      logger.error('Failed to query Walrus nodes', error);
      res.status(500).json({ error: 'Failed to query nodes' });
    }
  } catch (error) {
    logger.error('Error querying Walrus nodes', error);
    res.status(500).json({ error: 'Failed to query nodes' });
  }
});

/**
 * GET /walrus/nodes/:blobId
 * Get a specific node by blobId
 */
router.get('/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;

    const query = `
      query node($blobId: string) {
        nodes(func: eq(blobId, $blobId)) @filter(type(WalrusNode)) {
          uid
          blobId
          operatorAddress
          nodeAddress
          endpoint
          region
          public
          verified
          verifiedAt
          status
          reputation
          registeredAt
          lastSeen
        }
      }
    `;

    try {
      const result = await dgraphClient.query(query, { $blobId: blobId });
      const node = result.nodes?.[0];

      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }

      res.json({
        blobId: node.blobId,
        operatorAddress: node.operatorAddress,
        nodeAddress: node.nodeAddress,
        endpoint: node.endpoint,
        region: node.region,
        public: node.public,
        verified: node.verified,
        status: node.status,
        reputation: node.reputation || 0,
        registeredAt: node.registeredAt,
        lastSeen: node.lastSeen
      });
    } catch (error) {
      logger.error('Failed to query Walrus node', { blobId, error });
      res.status(500).json({ error: 'Failed to query node' });
    }
  } catch (error) {
    logger.error('Error querying Walrus node', error);
    res.status(500).json({ error: 'Failed to query node' });
  }
});

/**
 * PUT /walrus/nodes/:blobId/heartbeat
 * Update lastSeen timestamp (node heartbeat)
 */
router.put('/:blobId/heartbeat', async (req, res) => {
  try {
    const { blobId } = req.params;

    const query = `
      query node($blobId: string) {
        nodes(func: eq(blobId, $blobId)) @filter(type(WalrusNode)) {
          uid
        }
      }
    `;

    const result = await dgraphClient.query(query, { $blobId: blobId });
    const node = result.nodes?.[0];

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const mutation = {
      set: {
        uid: node.uid,
        lastSeen: new Date().toISOString()
      }
    };

    await dgraphClient.mutate(mutation);
    res.json({ success: true, blobId, lastSeen: new Date().toISOString() });
  } catch (error) {
    logger.error('Error updating node heartbeat', error);
    res.status(500).json({ error: 'Failed to update heartbeat' });
  }
});

export default router;
