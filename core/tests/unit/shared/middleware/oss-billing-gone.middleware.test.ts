import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../../../../src/shared/infra/http/hono-types.js';
import { signLocalJwt } from '../../../helpers/local-auth-jwt.js';

const { mockIsOss } = vi.hoisted(() => ({
  mockIsOss: vi.fn(() => true),
}));

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
    isOss: () => mockIsOss(),
  },
}));

const { ossBillingGoneMiddleware } =
  await import('../../../../src/shared/infra/http/middleware/oss-billing-gone.middleware.js');
const { authMiddleware } =
  await import('../../../../src/shared/infra/http/middleware/auth.middleware.js');
const { errorHandler } =
  await import('../../../../src/shared/infra/http/middleware/error-handler.js');

function createApp() {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);
  app.use('*', ossBillingGoneMiddleware);
  app.use('*', authMiddleware);
  app.post('/v1/billing/checkout', (c) => c.json({ url: 'https://stripe.example/checkout' }));
  app.post('/v1/billing/portal', (c) => c.json({ url: 'https://stripe.example/portal' }));
  app.get('/v1/billing/subscription', (c) => c.json({ plan: 'free', status: 'active' }));
  return app;
}

describe('ossBillingGoneMiddleware (AC-075)', () => {
  const app = createApp();
  const checkoutBody = {
    planKey: 'starter',
    successUrl: 'http://localhost/success',
    cancelUrl: 'http://localhost/cancel',
  };

  it('returns 410 for unauthenticated POST /v1/billing/checkout in OSS mode', async () => {
    mockIsOss.mockReturnValue(true);
    const res = await app.request('/v1/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutBody),
    });
    expect(res.status).toBe(410);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/billing is disabled/i);
  });

  it('returns 410 for authenticated POST /v1/billing/checkout in OSS mode', async () => {
    mockIsOss.mockReturnValue(true);
    const token = await signLocalJwt({
      sub: 'user-1',
      email: 'admin@example.com',
      tenant_id: 'tenant-1',
      roles: ['admin'],
    });
    const res = await app.request('/v1/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(checkoutBody),
    });
    expect(res.status).toBe(410);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/checkout is not available/i);
  });

  it('returns 410 for unauthenticated POST /v1/billing/portal in OSS mode', async () => {
    mockIsOss.mockReturnValue(true);
    const res = await app.request('/v1/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl: 'http://localhost/billing' }),
    });
    expect(res.status).toBe(410);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/portal is not available/i);
  });

  it('does not block GET /v1/billing/subscription in OSS mode (still requires auth)', async () => {
    mockIsOss.mockReturnValue(true);
    const res = await app.request('/v1/billing/subscription');
    expect(res.status).toBe(401);
  });

  it('passes through commercial billing paths when not in OSS mode', async () => {
    mockIsOss.mockReturnValue(false);
    const res = await app.request('/v1/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutBody),
    });
    expect(res.status).toBe(401);
  });
});
