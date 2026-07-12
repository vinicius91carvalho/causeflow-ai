import { createMiddleware } from 'hono/factory';
import { ForbiddenError } from '../../../domain/errors.js';
import type { AppEnv } from '../hono-types.js';
/**
 * Tenant guard: validates that the tenantId from JWT is present.
 * TenantId is now extracted from JWT in authMiddleware — this middleware
 * only ensures authenticated routes have a valid tenant context.
 *
 * For webhook routes (public), tenantId comes from the URL path param.
 */
export const tenantMiddleware = createMiddleware(async (c, next) => {
  const path = c.req.path;
  // Skip for public paths — webhooks/GitHub routes handle tenant via payload or query params
  // Skip for provisioning — POST /v1/tenants creates the first tenant (no tenant context yet)
  if (
    path === '/health' ||
    path === '/health/detailed' ||
    path === '/dashboard' ||
    path === '/admin/queues' ||
    path.startsWith('/v1/webhooks/') ||
    path.startsWith('/webhooks/') ||
    path.startsWith('/api/webhooks/') ||
    path.startsWith('/v1/signup') ||
    path.startsWith('/v1/auth/') ||
    path.startsWith('/v1/billing/webhook') ||
    path.startsWith('/v1/widget/') ||
    path.startsWith('/widget/') ||
    path.startsWith('/portal') ||
    path.startsWith('/v1/investigation/ws') ||
    path.startsWith('/v1/relay/connect') ||
    path === '/v1/integrations/slack/oauth/callback' ||
    path === '/v1/integrations/slack/events' ||
    (path === '/v1/tenants' && c.req.method === 'POST')
  ) {
    return next();
  }
  const tid = c.get('tenantId');
  if (!tid) {
    throw new ForbiddenError('No tenant context — JWT missing tenant_id claim');
  }
  return next();
});
