import { PresenceSession, Participant } from '@dlux-sui/types';
import { logger } from '../utils/logger';

// In-memory storage - replace with Redis/database in production
const sessions = new Map<string, PresenceSession>();
const participants = new Map<string, Participant>();

class PresenceManager {
  async initialize(): Promise<void> {
    logger.info('Presence manager initialized');
  }

  async shutdown(): Promise<void> {
    // Clean up all sessions
    for (const [sessionId, session] of sessions.entries()) {
      await this.endSession(sessionId);
    }
    logger.info('Presence manager shut down');
  }

  async createSession(dappId: string, creatorId: string): Promise<PresenceSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: PresenceSession = {
      id: sessionId,
      dappId,
      participants: [],
      createdAt: new Date()
    };

    sessions.set(sessionId, session);
    logger.info('Session created', { sessionId, dappId, creatorId });

    return session;
  }

  async joinSession(sessionId: string, participant: Omit<Participant, 'joinedAt' | 'lastSeen'>): Promise<boolean> {
    const session = sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const fullParticipant: Participant = {
      ...participant,
      joinedAt: new Date(),
      lastSeen: new Date()
    };

    session.participants.push(fullParticipant);
    participants.set(participant.id, fullParticipant);

    logger.info('Participant joined session', { sessionId, participantId: participant.id });
    return true;
  }

  async leaveSession(sessionId: string, participantId: string): Promise<boolean> {
    const session = sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.participants = session.participants.filter(p => p.id !== participantId);
    participants.delete(participantId);

    logger.info('Participant left session', { sessionId, participantId });

    // End session if no participants left
    if (session.participants.length === 0) {
      await this.endSession(sessionId);
    }

    return true;
  }

  async updateParticipant(sessionId: string, participantId: string, updates: Partial<Participant>): Promise<boolean> {
    const session = sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) {
      return false;
    }

    Object.assign(participant, updates, { lastSeen: new Date() });
    participants.set(participantId, participant);

    return true;
  }

  async getSession(sessionId: string): Promise<PresenceSession | null> {
    return sessions.get(sessionId) || null;
  }

  async getParticipant(participantId: string): Promise<Participant | null> {
    return participants.get(participantId) || null;
  }

  async listSessions(dappId?: string): Promise<PresenceSession[]> {
    const allSessions = Array.from(sessions.values());
    if (dappId) {
      return allSessions.filter(session => session.dappId === dappId);
    }
    return allSessions;
  }

  async endSession(sessionId: string): Promise<boolean> {
    const session = sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Remove all participants
    for (const participant of session.participants) {
      participants.delete(participant.id);
    }

    session.endedAt = new Date();
    sessions.delete(sessionId);

    logger.info('Session ended', { sessionId });
    return true;
  }

  async broadcastToSession(sessionId: string, event: string, data: any, excludeParticipantId?: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }

    for (const participant of session.participants) {
      if (excludeParticipantId && participant.id === excludeParticipantId) {
        continue;
      }

      // TODO: Send event to participant via WebSocket
      logger.debug('Broadcasting event to participant', {
        sessionId,
        participantId: participant.id,
        event
      });
    }
  }
}

export const presenceManager = new PresenceManager();