import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../../../../src/shared/infra/http/hono-types.js';
import { signExpiredLocalJwt, signLocalJwt } from '../../../helpers/local-auth-jwt.js';

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    auth: {
      jwtSecret: 'test-secret',
      jwtIssuer: 'causeflow',
      jwtAudience: 'causeflow-api',
    },
    clerk: {
      secretKey: '',
    },
    logLevel: 'silent',
    isDev: () => false,
    isProd: () => false,
    isTest: () => true,
    isOss: () => true,
  },
}));

const { authMiddleware } =
  await import('../../../../src/shared/infra/http/middleware/auth.middleware.js');
const { errorHandler } =
  await import('../../../../src/shared/infra/http/middleware/error-handler.js');

function createApp() {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);
  app.use('*', authMiddleware);

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/v1/webhooks/alerts', (c) => c.json({ webhook: true }));
  app.post('/v1/tenants', (c) =>
    c.json({
      userId: c.get('userId'),
      userEmail: c.get('userEmail'),
    }),
  );
  app.get('/test', (c) =>
    c.json({
      tenantId: c.get('tenantId'),
      userId: c.get('userId'),
      userEmail: c.get('userEmail'),
      userRoles: c.get('userRoles'),
    }),
  );

  return app;
}

describe('authMiddleware', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bypasses /health (200)', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('bypasses /v1/webhooks/... (200)', async () => {
    const res = await app.request('/v1/webhooks/alerts');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ webhook: true });
  });

  it('rejects missing Authorization header (401)', async () => {
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('UNAUTHORIZED');
    expect(body['message']).toContain('Missing or invalid Authorization header');
  });

  it('rejects invalid Bearer token (401)', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('UNAUTHORIZED');
    expect(body['message']).toContain('Invalid or expired token');
  });

  it('sets context variables with valid token (admin role)', async () => {
    const token = await signLocalJwt({
      sub: 'user-456',
      email: 'user@example.com',
      tenant_id: 'org_tenant123',
      roles: ['admin'],
    });

    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['tenantId']).toBe('org_tenant123');
    expect(body['userId']).toBe('user-456');
    expect(body['userEmail']).toBe('user@example.com');
    expect(body['userRoles']).toEqual(['admin']);
  });

  it('accepts member role from JWT claims', async () => {
    const token = await signLocalJwt({
      sub: 'user-789',
      email: 'member@example.com',
      tenant_id: 'org_tenant456',
      roles: ['member'],
    });

    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['tenantId']).toBe('org_tenant456');
    expect(body['userId']).toBe('user-789');
    expect(body['userRoles']).toEqual(['member']);
  });

  it('rejects token missing tenant_id on non-provisioning path (401)', async () => {
    const token = await signLocalJwt({
      sub: 'user-456',
      email: 'user@example.com',
    });

    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('UNAUTHORIZED');
    expect(body['message']).toContain('No tenant in token');
  });

  it('allows provisioning path (POST /v1/tenants) without tenant_id', async () => {
    const token = await signLocalJwt({
      sub: 'user-456',
      email: 'user@example.com',
    });

    const res = await app.request('/v1/tenants', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['userId']).toBe('user-456');
    expect(body['userEmail']).toBe('user@example.com');
  });

  it('rejects expired token (401)', async () => {
    const token = await signExpiredLocalJwt({
      sub: 'user-456',
      email: 'user@example.com',
      tenant_id: 'org_tenant123',
    });

    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('UNAUTHORIZED');
    expect(body['message']).toContain('Invalid or expired token');
  });

  it('verifies locally signed JWT with configured secret', async () => {
    const token = await signLocalJwt({
      sub: 'user-1',
      email: 'a@b.com',
      tenant_id: 'org_1',
      roles: ['admin'],
    });

    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['userId']).toBe('user-1');
    expect(body['tenantId']).toBe('org_1');
  });
});
