/* eslint-disable */
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }

  try {
    // Validate JWT token (simplified for fixture)
    const decoded = Buffer.from(token, 'base64').toString();
    const payload = JSON.parse(decoded);

    if (!payload.sub || !payload.exp) {
      res.status(401).json({ error: 'Invalid token format' });
      return;
    }

    if (Date.now() > payload.exp * 1000) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }

    (req as any).userId = payload.sub;
    next();
  } catch (err) {
    logger.warn({ err }, 'Auth token validation failed');
    res.status(401).json({ error: 'Invalid token' });
  }
}
