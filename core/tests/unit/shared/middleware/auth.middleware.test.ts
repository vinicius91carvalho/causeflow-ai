import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../../../../src/shared/infra/http/hono-types.js';

// Mock @clerk/backend before importing the middleware
const verifyTokenMock = vi.fn();
vi.mock('@clerk/backend', () => ({
  verifyToken: verifyTokenMock,
}));

// Mock config so the middleware doesn't need real env vars
vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    clerk: {
      secretKey: 'test-clerk-secret-key',
    },
    logLevel: 'silent',
    isDev: () => false,
    isProd: () => false,
    isTest: () => true,
  },
}));

// Import after mocks are set up
const { authMiddleware } = await import(
  '../../../../src/shared/infra/http/middleware/auth.middleware.js'
);
const { errorHandler } = await import(
  '../../../../src/shared/infra/http/middleware/error-handler.js'
);

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
    verifyTokenMock.mockReset();
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
    verifyTokenMock.mockRejectedValue(new Error('Invalid token'));

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('UNAUTHORIZED');
    expect(body['message']).toContain('Invalid or expired token');
  });

  it('sets context variables with valid token (org:admin role)', async () => {
    verifyTokenMock.mockResolvedValue({
      sub: 'user-456',
      org_id: 'org_tenant123',
      org_role: 'org:admin',
      email: 'user@example.com',
    });

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['tenantId']).toBe('org_tenant123');
    expect(body['userId']).toBe('user-456');
    expect(body['userEmail']).toBe('user@example.com');
    expect(body['userRoles']).toEqual(['admin']);
  });

  it('maps non-admin org_role to member', async () => {
    verifyTokenMock.mockResolvedValue({
      sub: 'user-789',
      org_id: 'org_tenant456',
      org_role: 'org:member',
      email: 'member@example.com',
    });

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['tenantId']).toBe('org_tenant456');
    expect(body['userId']).toBe('user-789');
    expect(body['userRoles']).toEqual(['member']);
  });

  it('rejects token missing org_id on non-provisioning path (401)', async () => {
    verifyTokenMock.mockResolvedValue({
      sub: 'user-456',
      email: 'user@example.com',
    });

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('UNAUTHORIZED');
    expect(body['message']).toContain('No organization selected');
  });

  it('allows provisioning path (POST /v1/tenants) without org_id', async () => {
    verifyTokenMock.mockResolvedValue({
      sub: 'user-456',
      email: 'user@example.com',
    });

    const res = await app.request('/v1/tenants', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['userId']).toBe('user-456');
    expect(body['userEmail']).toBe('user@example.com');
  });

  it('rejects expired token (401)', async () => {
    verifyTokenMock.mockRejectedValue(new Error('Token has expired'));

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer expired-token' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('UNAUTHORIZED');
    expect(body['message']).toContain('Invalid or expired token');
  });

  it('passes token and secretKey to verifyToken', async () => {
    verifyTokenMock.mockResolvedValue({
      sub: 'user-1',
      org_id: 'org_1',
      email: 'a@b.com',
    });

    await app.request('/test', {
      headers: { Authorization: 'Bearer my-jwt-token' },
    });

    expect(verifyTokenMock).toHaveBeenCalledWith('my-jwt-token', {
      secretKey: 'test-clerk-secret-key',
    });
  });
});
