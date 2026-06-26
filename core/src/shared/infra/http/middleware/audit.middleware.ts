import { createMiddleware } from 'hono/factory';
import { logger } from '../../logger.js';
import type { AppEnv } from '../hono-types.js';
export const auditMiddleware = createMiddleware(async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    const method = c.req.method;
    const path = c.req.path;
    const status = c.res.status;
    const tenantId = c.get('tenantId') ?? 'anonymous';
    if (method !== 'GET' && method !== 'OPTIONS') {
        logger.info({ method, path, status, duration, tenantId }, 'audit: mutating request');
    }
});
