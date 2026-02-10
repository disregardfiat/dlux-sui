/**
 * Optional JWT auth middleware for personal-data routes.
 * Verifies Bearer token (same secret as sui-service); sets req.auth = { suiAddress } or null.
 * Does not reject unauthenticated requests - route handlers decide when to require auth.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthPayload {
  suiAddress: string;
  iat?: number;
  exp?: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPayload | null;
  }
}

export function attachAuth(req: Request, _res: Response, next: NextFunction): void {
  req.auth = null;
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }
  const token = header.slice(7).trim();
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (decoded && typeof decoded.suiAddress === 'string') {
      req.auth = { suiAddress: decoded.suiAddress, iat: decoded.iat, exp: decoded.exp };
    }
  } catch (err) {
    logger.debug('JWT verification failed in dgraph-service', { error: err instanceof Error ? err.message : String(err) });
  }
  next();
}

/** Normalize address for comparison (lowercase). */
export function sameParty(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}
