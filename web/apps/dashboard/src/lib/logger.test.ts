import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { REDACT_PATHS_FOR_TESTS } from './logger';

/**
 * AC-042: the dashboard pino logger must redact auth headers, Clerk session
 * tokens, and Stripe secrets (Stripe-specific field names + env-style keys)
 * at every nesting level, while preserving the structured observability
 * payload (method, path, userId, tenantId, duration).
 *
 * The exported `logger` writes to stdout via sonic-boom, which is awkward to
 * capture deterministically. Instead we build a pino instance from the exact
 * same REDACT_PATHS_FOR_TESTS export the production logger uses, writing to a
 * capturing Writable. This exercises the real fast-redact configuration at
 * the real pino formatting boundary.
 */
function makeCapturingLogger(sink: string[]) {
  const dest = new Writable({
    write(chunk: Buffer, _enc, cb) {
      sink.push(chunk.toString());
      cb();
    },
  });
  return pino({ redact: REDACT_PATHS_FOR_TESTS }, dest);
}

describe('logger redaction (AC-042)', () => {
  it('redacts Stripe-specific + env-style secret keys at every nesting level', () => {
    const sink: string[] = [];
    const log = makeCapturingLogger(sink);
    const err = new Error('checkout boom');
    log.error(
      {
        err,
        method: 'POST',
        path: '/api/billing/checkout',
        userId: 'user_1',
        tenantId: 'org_1',
        duration: 42,
        // top-level Stripe / env-style secrets
        stripeSecretKey: 'sk_live_51LEAKSTRIPE',
        stripeToken: 'tok_visa_leak',
        stripePaymentMethodId: 'pm_leak',
        stripePublishableKey: 'pk_live_leak',
        clerkSecretKey: 'sk_clerk_leak',
        STRIPE_SECRET_KEY: 'sk_live_51LEAKENV',
        STRIPE_WEBHOOK_SECRET: 'whsec_leak',
        STRIPE_PUBLISHABLE_KEY: 'pk_live_leak',
        CLERK_SECRET_KEY: 'sk_clerk_leak',
        // nested one level deep
        body: {
          stripeSecretKey: 'sk_live_nested',
          STRIPE_SECRET_KEY: 'sk_live_nested_env',
        },
        // nested two levels deep under body.credentials
        credentials: { stripeSecretKey: 'sk_live_deep' },
        req: { headers: { stripeSecretKey: 'sk_live_header' } },
      },
      'Unhandled error in POST /api/billing/checkout',
    );

    const parsed = JSON.parse(sink.join(''));

    // Structured payload preserved
    expect(parsed.method).toBe('POST');
    expect(parsed.path).toBe('/api/billing/checkout');
    expect(parsed.userId).toBe('user_1');
    expect(parsed.tenantId).toBe('org_1');
    expect(parsed.duration).toBe(42);

    // Top-level Stripe / env secrets redacted
    expect(parsed.stripeSecretKey).toBe('[Redacted]');
    expect(parsed.stripeToken).toBe('[Redacted]');
    expect(parsed.stripePaymentMethodId).toBe('[Redacted]');
    expect(parsed.stripePublishableKey).toBe('[Redacted]');
    expect(parsed.clerkSecretKey).toBe('[Redacted]');
    expect(parsed.STRIPE_SECRET_KEY).toBe('[Redacted]');
    expect(parsed.STRIPE_WEBHOOK_SECRET).toBe('[Redacted]');
    expect(parsed.STRIPE_PUBLISHABLE_KEY).toBe('[Redacted]');
    expect(parsed.CLERK_SECRET_KEY).toBe('[Redacted]');

    // Nested
    expect(parsed.body.stripeSecretKey).toBe('[Redacted]');
    expect(parsed.body.STRIPE_SECRET_KEY).toBe('[Redacted]');
    expect(parsed.credentials.stripeSecretKey).toBe('[Redacted]');
    expect(parsed.req.headers.stripeSecretKey).toBe('[Redacted]');

    // No secret value leaked anywhere in the raw output
    const raw = sink.join('');
    expect(raw).not.toContain('sk_live_');
    expect(raw).not.toContain('tok_visa_leak');
    expect(raw).not.toContain('whsec_leak');
    expect(raw).not.toContain('pk_live_leak');
    expect(raw).not.toContain('sk_clerk_leak');
  });

  it('redacts auth headers, Clerk session cookie, and body credentials', () => {
    const sink: string[] = [];
    const log = makeCapturingLogger(sink);
    log.error({
      method: 'POST',
      path: '/api/billing/subscribe',
      userId: 'user_1',
      tenantId: 'org_1',
      duration: 7,
      req: {
        headers: {
          authorization: 'Bearer clerk_db_jwt_secret',
          cookie: '__session=clerk_jwt_secret; other=1',
          'x-api-key': 'ak_secret',
          'x-clerk-auth-token': 'clerk_token_secret',
          'x-session-token': 'session_secret',
        },
      },
      body: {
        secret: 'whsec_secret',
        apiKey: 'ak_secret',
        token: 'tok_secret',
        password: 'pw_secret',
        credentials: { stripeSecretKey: 'sk_live_secret' },
      },
    });

    const parsed = JSON.parse(sink.join(''));
    expect(parsed.req.headers.authorization).toBe('[Redacted]');
    expect(parsed.req.headers.cookie).toBe('[Redacted]');
    expect(parsed.req.headers['x-api-key']).toBe('[Redacted]');
    expect(parsed.req.headers['x-clerk-auth-token']).toBe('[Redacted]');
    expect(parsed.req.headers['x-session-token']).toBe('[Redacted]');
    expect(parsed.body.secret).toBe('[Redacted]');
    expect(parsed.body.apiKey).toBe('[Redacted]');
    expect(parsed.body.token).toBe('[Redacted]');
    expect(parsed.body.password).toBe('[Redacted]');
    expect(parsed.body.credentials).toBe('[Redacted]');

    const raw = sink.join('');
    expect(raw).not.toContain('clerk_db_jwt_secret');
    expect(raw).not.toContain('clerk_jwt_secret');
    expect(raw).not.toContain('Bearer ');
    expect(raw).not.toContain('whsec_secret');
    expect(raw).not.toContain('sk_live_secret');
  });

  it('redacts PII (email, name) at nested levels, not just top-level', () => {
    const sink: string[] = [];
    const log = makeCapturingLogger(sink);
    log.info({
      email: 'top@example.com',
      name: 'Top User',
      user: { email: 'nested@example.com', name: 'Nested User' },
      body: { email: 'body@example.com', name: 'Body User' },
    });

    const parsed = JSON.parse(sink.join(''));
    expect(parsed.email).toBe('[Redacted]');
    expect(parsed.name).toBe('[Redacted]');
    expect(parsed.user.email).toBe('[Redacted]');
    expect(parsed.user.name).toBe('[Redacted]');
    expect(parsed.body.email).toBe('[Redacted]');
    expect(parsed.body.name).toBe('[Redacted]');

    const raw = sink.join('');
    expect(raw).not.toContain('@example.com');
    expect(raw).not.toContain('User');
  });
});
