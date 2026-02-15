import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { ApolloServer } from 'apollo-server-express';
import { logger } from './utils/logger';
import { dgraphClient } from './dgraph/client';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { socialRouter } from './routes/social';
import impressionsRouter from './routes/impressions';
import adsRouter from './routes/ads';
import installsRouter from './routes/installs';
import { campaignsRouter } from './routes/campaigns';
import { analyticsRouter } from './routes/analytics';
import { marketsRouter } from './routes/markets';
import { safetyRouter } from './routes/safety';
import { governanceRouter } from './routes/governance';
import { earningsRouter } from './routes/earnings';
import { subscriptionRouter } from './routes/subscription';
import locationRouter from './routes/location';
import walrusNodesRouter from './routes/walrusNodes';
import { attachAuth } from './middleware/auth';
import { blockchainIndexer } from './services/blockchainIndexer';
import { socialBlockchain } from './services/socialBlockchain';
import { startMarketsScheduler, stopMarketsScheduler } from './services/marketsScheduler';

dotenv.config();

// Catch unhandled rejections so one bad API call doesn't crash the whole process
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise: String(promise) });
});

async function startServer() {
  const app = express();
  // Force PORT to 3003 - Caddy routes gql.dlux.io to this port
  const PORT_ENV = parseInt(process.env.PORT || '3003', 10);
  if (PORT_ENV !== 3003) {
    logger.warn(`PORT environment variable is set to ${PORT_ENV}, but dgraph-service must run on 3003 for Caddy routing. Overriding to 3003.`);
  }
  const PORT = 3003;

  // Middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
  }));
  app.use(cors({
    origin: true, // Allow all origins (Caddy handles security)
    credentials: true // Allow credentials (cookies, auth headers)
  }));
  app.use(express.json());
  // Optional JWT auth for personal-data routes (sets req.auth when Bearer token valid)
  app.use(attachAuth);

  // Health check - basic
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Enriched health - indexer state, capabilities
  app.get('/health/detailed', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      capabilities: {
        blockchainIndexerEnabled: process.env.BLOCKCHAIN_INDEXER_ENABLED === 'true',
        blockchainIndexerPollInterval: process.env.BLOCKCHAIN_INDEXER_POLL_INTERVAL || '300000'
      }
    });
  });

  // Admin endpoints for replication
  // Note: Dgraph export/backup requires admin GraphQL API at :8080/admin
  // These endpoints are stubs for MVP - full implementation requires HTTP calls to Dgraph admin API
  app.post('/admin/export', async (req, res) => {
    try {
      const exportPath = req.body.path || '/tmp/dgraph-export';
      const format = req.body.format || 'rdf';

      // TODO: Implement via Dgraph admin GraphQL API (POST to :8080/admin)
      // For MVP, log the request and return success placeholder
      logger.info('Dgraph export requested (not yet implemented)', { exportPath, format });
      res.json({
        success: false,
        message: 'Export endpoint not yet implemented - requires Dgraph admin API integration',
        exportPath,
        format
      });
    } catch (error) {
      logger.error('Export failed', error);
      res.status(500).json({ error: 'Export failed', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Admin endpoint to reset/wipe DGraph (drop all data)
  app.post('/admin/reset', async (req, res) => {
    try {
      if (!dgraphAvailable) {
        return res.status(503).json({ error: 'DGraph not available' });
      }
      logger.warn('DGraph reset requested - dropping all data');
      await dgraphClient.dropAll();
      logger.info('DGraph reset complete - all data dropped');
      res.json({
        success: true,
        message: 'DGraph reset complete - all data dropped'
      });
    } catch (error) {
      logger.error('DGraph reset failed', error);
      res.status(500).json({ 
        error: 'Reset failed', 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.post('/admin/backup', async (req, res) => {
    try {
      const backupPath = req.body.path || '/tmp/dgraph-backup';
      const destination = req.body.destination || 'file://' + backupPath;

      // TODO: Implement via Dgraph admin GraphQL API (POST to :8080/admin)
      // For MVP, log the request and return success placeholder
      logger.info('Dgraph backup requested (not yet implemented)', { backupPath, destination });
      res.json({
        success: false,
        message: 'Backup endpoint not yet implemented - requires Dgraph admin API integration',
        backupPath,
        destination
      });
    } catch (error) {
      logger.error('Backup failed', error);
      res.status(500).json({ error: 'Backup failed', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Social blockchain endpoints
  app.get('/blocks/latest', async (req, res) => {
    try {
      // Get latest social block info
      const query = `
        query latestBlock {
          blocks(func: type(SocialBlock), orderdesc: blockNumber, first: 1) {
            id
            blockNumber
            blockHash
            timestamp
            walrusId
            interactionCount: count(~interactions)
          }
        }
      `;

      const result = await dgraphClient.query(query);
      const block = result.blocks?.[0];

      if (!block) {
        return res.json({ latestBlock: null });
      }

      res.json({
        latestBlock: {
          ...block,
          timestamp: new Date(block.timestamp)
        }
      });
    } catch (error) {
      logger.error('Failed to get latest block', error);
      res.status(500).json({ error: 'Failed to get latest block' });
    }
  });

  app.get('/blocks/:blockId', async (req, res) => {
    try {
      const { blockId } = req.params;
      const isValid = await socialBlockchain.verifyBlockProvenance(blockId);

      if (!isValid) {
        return res.status(400).json({ error: 'Block provenance verification failed' });
      }

      // Get block details
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
              timestamp
              sequence
            }
            signatures {
              signer
              ecosystemId
              timestamp
            }
          }
        }
      `;

      const result = await dgraphClient.query(query, { $id: blockId });
      const block = result.block?.[0];

      if (!block) {
        return res.status(404).json({ error: 'Block not found' });
      }

      res.json({
        block: {
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
        },
        verified: true
      });
    } catch (error) {
      logger.error('Failed to get block', error);
      res.status(500).json({ error: 'Failed to get block' });
    }
  });

  app.get('/ecosystem/peers', async (req, res) => {
    try {
      // Get active ecosystem peers
      const query = `
        query peers {
          peers(func: type(EcosystemPeer)) @filter(eq(isActive, true)) {
            id
            name
            dgraphEndpoint
            lastSeenBlock
            lastSeen
          }
        }
      `;

      const result = await dgraphClient.query(query);

      res.json({
        peers: (result.peers || []).map((peer: any) => ({
          ...peer,
          lastSeen: new Date(peer.lastSeen)
        }))
      });
    } catch (error) {
      logger.error('Failed to get ecosystem peers', error);
      res.status(500).json({ error: 'Failed to get ecosystem peers' });
    }
  });

  app.post('/ecosystem/register-peer', async (req, res) => {
    try {
      const { id, name, dgraphEndpoint, publicKey } = req.body;

      if (!id || !name || !dgraphEndpoint || !publicKey) {
        return res.status(400).json({
          error: 'id, name, dgraphEndpoint, and publicKey are required'
        });
      }

      // Register new ecosystem peer
      const mutation = {
        set: {
          uid: `_:peer_${id}`,
          dgraph_type: 'EcosystemPeer',
          id,
          name,
          dgraphEndpoint,
          publicKey,
          lastSeenBlock: 0,
          lastSeen: new Date().toISOString(),
          isActive: true
        }
      };

      await dgraphClient.mutate(mutation);

      logger.info('Ecosystem peer registered', { peerId: id, name });
      res.json({ success: true, message: 'Peer registered successfully' });
    } catch (error) {
      logger.error('Failed to register peer', error);
      res.status(500).json({ error: 'Failed to register peer' });
    }
  });

  // Social API routes (signed but not broadcast to SUI)
  app.use('/social', socialRouter);

  // Ad impression tracking (privacy-preserving with ZK proofs)
  app.use('/impressions', impressionsRouter);
  app.use('/ads', adsRouter);
  app.use('/installs', installsRouter);
  app.use('/campaigns', campaignsRouter);
  app.use('/analytics', analyticsRouter);
  app.use('/markets', marketsRouter);
  app.use('/safety', safetyRouter);
  app.use('/governance', governanceRouter);
  app.use('/subscription', subscriptionRouter);
  app.use('/earnings', earningsRouter);

  // Location-based vector search (privacy-preserving)
  app.use('/location', locationRouter);
  // Alias for /search/location endpoint
  app.post('/search/location', (req, res, next) => {
    req.url = '/search';
    locationRouter(req, res, next);
  });

  // Walrus node registry (minimal index - full data in Walrus)
  app.use('/walrus/nodes', walrusNodesRouter);

  // Initialize dGraph client (optional - service can run without it)
  let dgraphAvailable = false;
  try {
    await dgraphClient.connect();
    logger.info('Connected to dGraph database');
    dgraphAvailable = true;

    // Initialize schema (idempotent operation)
    const schemaPath = path.join(__dirname, 'dgraph', 'schema.dql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await dgraphClient.alterSchema(schema);
      logger.info('Dgraph schema initialized');
    } else {
      logger.warn('Schema file not found, skipping schema initialization');
    }
  } catch (dgraphError) {
    logger.warn('DGraph not available - service will run in test mode (in-memory repositories)');
    logger.warn('To use DGraph: start DGraph server on port 9080 or set DGRAPH_HOST');
    logger.warn('This is OK for development/testing - repositories will use in-memory mode');
    // Continue without DGraph - repositories will use in-memory mode
  }

  try {

    // Create Apollo Server
    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req }) => ({
        // Add authentication context here
        user: req.headers.authorization
      }),
      introspection: process.env.NODE_ENV !== 'production'
    });

    await server.start();

    // Apply GraphQL middleware
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.applyMiddleware({ app: app as any, path: '/graphql' });

    // Start blockchain indexer to sync SUI data to Dgraph (only if DGraph is connected and explicitly enabled)
    const blockchainIndexerEnabled = process.env.BLOCKCHAIN_INDEXER_ENABLED === 'true';
    if (dgraphAvailable && blockchainIndexerEnabled) {
      try {
        await blockchainIndexer.start();
      } catch (error) {
        logger.warn('Blockchain indexer not started', error);
      }
    } else if (!blockchainIndexerEnabled) {
      logger.info('Blockchain indexer disabled via BLOCKCHAIN_INDEXER_ENABLED=false');
    } else {
      logger.info('Skipping blockchain indexer - DGraph not available');
    }

    // Initialize social blockchain for ecosystem replication (only if DGraph is connected)
    if (dgraphAvailable) {
      try {
        await socialBlockchain.initialize();
      } catch (error) {
        logger.warn('Social blockchain not initialized', error);
      }
    } else {
      logger.info('Skipping social blockchain - DGraph not available');
    }

    // Start PM auto-resolve scheduler (expired markets resolve capital-weighted)
    if (dgraphAvailable) {
      startMarketsScheduler();
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`dGraph Service listening on port ${PORT}`);
      logger.info(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    }).on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Please free the port or set a different PORT environment variable.`);
        logger.error(`To find what's using port ${PORT}: lsof -i :${PORT} or ss -tlnp | grep :${PORT}`);
        process.exit(1);
      } else {
        logger.error('Failed to start server', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Failed to initialize dGraph service', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopMarketsScheduler();
  await dgraphClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopMarketsScheduler();
  await dgraphClient.disconnect();
  process.exit(0);
});

startServer().catch(error => {
  logger.error('Failed to start server', error);
  process.exit(1);
});