import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { tenantMiddleware } from '../../../../src/shared/infra/http/middleware/tenant.middleware.js';
import { errorHandler } from '../../../../src/shared/infra/http/middleware/error-handler.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';
import type { AppEnv } from '../../../../src/shared/infra/http/hono-types.js';

/**
 * Helper middleware that injects a tenantId into the context,
 * simulating what authMiddleware would do in production.
 */
const injectTenant = createMiddleware<AppEnv>(async (c, next) => {
  c.set('tenantId', tenantId('tenant-abc'));
  return next();
});

function createApp(options: { withTenant: boolean }) {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);

  if (options.withTenant) {
    app.use('*', injectTenant);
  }
  app.use('*', tenantMiddleware);

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/v1/webhooks/alerts', (c) => c.json({ webhook: true }));
  app.get('/test', (c) => c.json({ tenantId: c.get('tenantId') }));

  return app;
}

describe('tenantMiddleware', () => {
  it('bypasses /health (200)', async () => {
    const app = createApp({ withTenant: false });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('bypasses /v1/webhooks/... (200)', async () => {
    const app = createApp({ withTenant: false });
    const res = await app.request('/v1/webhooks/alerts');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ webhook: true });
  });

  it('passes when tenantId is present in context (200)', async () => {
    const app = createApp({ withTenant: true });
    const res = await app.request('/test');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['tenantId']).toBe('tenant-abc');
  });

  it('rejects when tenantId is missing (403)', async () => {
    const app = createApp({ withTenant: false });
    const res = await app.request('/test');
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('FORBIDDEN');
    expect(body['message']).toContain('No tenant context');
  });
});
