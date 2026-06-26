/* eslint-disable */
import type { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60000;
const MAX_REQUESTS = 100;

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  next();
}
