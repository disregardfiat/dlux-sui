import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Server as HocuspocusServer } from '@hocuspocus/server';
import { logger } from './utils/logger';
import { presenceManager } from './presence/presenceManager';
import { turnServer } from './webrtc/turnServer';
import { signalingServer } from './webrtc/signalingServer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TURN/STUN server info endpoint
app.get('/turn', (req, res) => {
  const turnConfig = turnServer.getConfig();
  res.json(turnConfig);
});

// WebRTC signaling endpoint
app.post('/signal', (req, res) => {
  signalingServer.handleSignal(req, res);
});

// Hocuspocus WebSocket server for real-time collaboration
const hocuspocus = new HocuspocusServer({
  port: parseInt(process.env.HOCUSPOCUS_PORT || '3005'),
  onAuthenticate: ({ token }) => {
    // TODO: Implement authentication
    return true;
  },
  onConnect: ({ documentName, requestHeaders }) => {
    logger.info('Hocuspocus client connected', { documentName });
  },
  onDisconnect: ({ documentName }) => {
    logger.info('Hocuspocus client disconnected', { documentName });
  }
});

// Start all services
async function startServices() {
  try {
    // Initialize presence manager
    await presenceManager.initialize();
    logger.info('Presence manager initialized');

    // Start TURN server
    await turnServer.start();
    logger.info('TURN server started');

    // Start signaling server
    await signalingServer.start();
    logger.info('Signaling server started');

    // Start Hocuspocus server
    await hocuspocus.listen();
    logger.info('Hocuspocus server started');

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Presence Service HTTP server listening on port ${PORT}`);
    });

  } catch (error) {
    logger.error('Failed to initialize presence service', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await hocuspocus.destroy();
  await turnServer.stop();
  await signalingServer.stop();
  await presenceManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await hocuspocus.destroy();
  await turnServer.stop();
  await signalingServer.stop();
  await presenceManager.shutdown();
  process.exit(0);
});

startServices().catch(error => {
  logger.error('Failed to start services', error);
  process.exit(1);
});