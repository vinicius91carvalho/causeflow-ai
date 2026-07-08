import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AC-042 integration: when a representative API handler (billing/checkout)
 * catches a non-recoverable error, it must
 *  (a) emit a pino error log with { method, path, userId, tenantId, duration },
 *  (b) forward the error to Sentry (Sentry.captureException),
 *  (c) leak no Stripe secret or JWT in the log payload.
 *
 * withAuth is mocked to pass-through so we exercise the handler's own catch.
 */
const capturedLogLines: string[] = [];
vi.mock('@/lib/logger', () => {
  const { Writable } = require('node:stream') as typeof import('node:stream');
  const pino = require('pino') as typeof import('pino');
  const dest = new Writable({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      capturedLogLines.push(chunk.toString());
      cb();
    },
  });
  const logger = pino(
    {
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'body.password',
        'body.token',
        'body.refreshToken',
        'body.accessToken',
        'body.secret',
        'body.apiKey',
        'body.credentials',
        'body.credentials.*',
        'email',
        'name',
        'stripeSecretKey',
        '*.stripeSecretKey',
        'stripeToken',
        '*.stripeToken',
        'STRIPE_SECRET_KEY',
        '*.STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        '*.STRIPE_WEBHOOK_SECRET',
        'body.STRIPE_SECRET_KEY',
        'body.*.STRIPE_SECRET_KEY',
      ],
    },
    dest,
  );
  return { logger };
});

const sentryMock = { captureException: vi.fn(), captureRequestError: vi.fn() };
vi.mock('@sentry/nextjs', () => ({ default: sentryMock, ...sentryMock }));

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, {
      userId: 'user_acme',
      tenantId: 'org_acme',
      role: 'admin',
      email: 'a@b.com',
      name: 'A',
      profileComplete: true,
      isStaff: false,
    }),
}));

const mockCreateCheckout = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({ createCheckout: mockCreateCheckout }),
}));

// Import after mocks are registered.
const { POST } = await import('./checkout-handler');

function checkoutRequest() {
  return new NextRequest('http://localhost:3001/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ planId: 'starter', from: 'billing' }),
    headers: {
      'Content-Type': 'application/json',
      authorization: 'Bearer clerk_db_jwt_SECRETVALUE',
      cookie: '__session=clerk_jwt_SECRETVALUE',
    },
  });
}

describe('POST /api/billing/checkout — non-recoverable error (AC-042)', () => {
  beforeEach(() => {
    capturedLogLines.length = 0;
    sentryMock.captureException.mockClear();
    mockCreateCheckout.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('logs structured payload, forwards to Sentry, and leaks no secrets', async () => {
    // Core API throws an error that carries Stripe secrets as enumerable
    // properties (the realistic leak vector). The handler logs `err`, so pino
    // serializes these fields — they must be redacted via `*.stripeSecretKey`
    // / `*.STRIPE_SECRET_KEY` paths. The error message itself is generic.
    const stripeyError = Object.assign(new Error('Failed to create checkout session'), {
      stripeSecretKey: 'sk_live_51SECRET',
      STRIPE_SECRET_KEY: 'sk_live_51SECRET',
    });
    mockCreateCheckout.mockRejectedValueOnce(stripeyError);

    // biome-ignore lint/suspicious/noExplicitAny: withAuth mock returns 1-arg fn
    const res = await (POST as any)(checkoutRequest());
    expect(res.status).toBe(500);

    // (a) a pino error log with structured payload was emitted
    expect(capturedLogLines.length).toBeGreaterThan(0);
    const logObj = JSON.parse(capturedLogLines.join(''));
    expect(logObj.level).toBe(50); // pino error level
    expect(logObj.method).toBe('POST');
    expect(logObj.path).toBe('/api/billing/checkout');
    expect(logObj.userId).toBe('user_acme');
    expect(logObj.tenantId).toBe('org_acme');
    expect(typeof logObj.duration).toBe('number');

    // (b) Sentry.captureException was invoked with the error + structured extra
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    const [capturedErr, scope] = sentryMock.captureException.mock.calls[0];
    expect(capturedErr).toBe(stripeyError);
    expect(scope.extra).toMatchObject({
      method: 'POST',
      path: '/api/billing/checkout',
      userId: 'user_acme',
      tenantId: 'org_acme',
    });

    // (c) no Stripe secret or JWT appears anywhere in the raw log payload
    const raw = capturedLogLines.join('');
    expect(raw).not.toContain('sk_live_');
    expect(raw).not.toContain('whsec_');
    expect(raw).not.toContain('clerk_db_jwt_SECRETVALUE');
    expect(raw).not.toContain('clerk_jwt_SECRETVALUE');
    expect(raw).not.toContain('Bearer ');
  });
});
