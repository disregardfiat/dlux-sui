import { WebRTCMessage } from '@dlux-sui/types';
import { logger } from '../utils/logger';

// In-memory signaling storage - replace with Redis in production
const signalMessages = new Map<string, WebRTCMessage[]>();

class SignalingManager {
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    logger.info('Signaling server started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    signalMessages.clear();
    logger.info('Signaling server stopped');
  }

  handleSignal(req: any, res: any): void {
    try {
      const message: WebRTCMessage = req.body;

      if (!message || !message.sessionId || !message.from) {
        res.status(400).json({ error: 'Invalid signal message' });
        return;
      }

      // Store message for recipient
      const sessionMessages = signalMessages.get(message.sessionId) || [];
      sessionMessages.push({
        ...message,
        timestamp: new Date()
      } as any);

      // Keep only recent messages (last 100 per session)
      if (sessionMessages.length > 100) {
        sessionMessages.splice(0, sessionMessages.length - 100);
      }

      signalMessages.set(message.sessionId, sessionMessages);

      logger.debug('Signal message stored', {
        sessionId: message.sessionId,
        from: message.from,
        type: message.type
      });

      res.json({ success: true });

    } catch (error) {
      logger.error('Error handling signal', error);
      res.status(500).json({ error: 'Signaling failed' });
    }
  }

  getMessages(sessionId: string, participantId: string): WebRTCMessage[] {
    const sessionMessages = signalMessages.get(sessionId) || [];
    return sessionMessages.filter(msg => msg.to === participantId || !msg.to);
  }

  clearMessages(sessionId: string): void {
    signalMessages.delete(sessionId);
  }

  pollMessages(sessionId: string, participantId: string, since?: Date): WebRTCMessage[] {
    const messages = this.getMessages(sessionId, participantId);
    if (since) {
      return messages.filter(msg => (msg as any).timestamp > since);
    }
    return messages;
  }
}

export const signalingServer = new SignalingManager();