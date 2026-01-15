import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ApolloServer } from 'apollo-server-express';
import { logger } from './utils/logger';
import { dgraphClient } from './dgraph/client';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { socialRouter } from './routes/social';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3003;

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Social API routes (signed but not broadcast to SUI)
  app.use('/social', socialRouter);

  try {
    // Initialize dGraph client
    await dgraphClient.connect();
    logger.info('Connected to dGraph database');

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
    server.applyMiddleware({ app, path: '/graphql' });

    // Start server
    app.listen(PORT, () => {
      logger.info(`dGraph Service listening on port ${PORT}`);
      logger.info(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    });

  } catch (error) {
    logger.error('Failed to initialize dGraph service', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await dgraphClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await dgraphClient.disconnect();
  process.exit(0);
});

startServer().catch(error => {
  logger.error('Failed to start server', error);
  process.exit(1);
});