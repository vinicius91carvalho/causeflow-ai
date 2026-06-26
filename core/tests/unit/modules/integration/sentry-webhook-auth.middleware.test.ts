import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import type { AppEnv } from '../../../../src/shared/infra/http/hono-types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const CLIENT_SECRET = 'test-sentry-client-secret-32chars!!';
const TENANT_ID = 'tenant-sentry-test-001';

function signBody(body: string, secret: string): string {
    return createHmac('sha256', secret).update(body).digest('hex');
}

// ─── Mock repository ────────────────────────────────────────────────────────

function makeMockSentryIntegrationRepo(overrides: {
    clientSecret?: string | null;
    tenantIdMismatch?: boolean;
} = {}) {
    const { clientSecret = CLIENT_SECRET, tenantIdMismatch = false } = overrides;
    return {
        findSentryClientSecret: vi.fn(async (_tenantId: string) => {
            if (tenantIdMismatch) return null;
            return clientSecret;
        }),
        setClientSecret: vi.fn(async () => {}),
        markVerified: vi.fn(async () => {}),
        markEventReceived: vi.fn(async () => {}),
        getSentryStatus: vi.fn(async () => ({
            configured: !!clientSecret,
            verified: false,
            verifiedAt: null,
            lastEventAt: null,
        })),
    };
}

// ─── Import the middleware under test ───────────────────────────────────────

async function importMiddleware(repo: ReturnType<typeof makeMockSentryIntegrationRepo>) {
    // Dynamic import so we can provide fresh mocks each time
    const { createSentryWebhookAuth } = await import(
        '../../../../src/modules/integration/infra/middleware/sentry-webhook-auth.middleware.js'
    );
    return createSentryWebhookAuth(repo);
}

// ─── Test app builder ───────────────────────────────────────────────────────

async function buildApp(repo: ReturnType<typeof makeMockSentryIntegrationRepo>) {
    const middleware = await importMiddleware(repo);
    const app = new Hono<AppEnv>();
    // Inline error handler: check statusCode property directly (avoids instanceof issues
    // across module reset boundaries caused by vi.resetModules())
    app.onError((err, c) => {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (typeof statusCode === 'number') {
            return c.json({ error: (err as { code?: string }).code ?? 'ERROR', message: err.message }, statusCode as 401 | 403 | 404 | 400 | 409 | 429 | 402 | 500);
        }
        return c.json({ error: 'INTERNAL_ERROR', message: err.message }, 500);
    });
    app.use('/:tenantId/sentry', middleware);
    app.post('/:tenantId/sentry', (c) => c.json({ ok: true }));
    return app;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('sentryWebhookAuth middleware', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('calls next() when Sentry-Hook-Signature matches HMAC of raw body', async () => {
        const repo = makeMockSentryIntegrationRepo();
        const app = await buildApp(repo);
        const body = JSON.stringify({ action: 'triggered', data: { issue: { id: '1' } } });
        const sig = signBody(body, CLIENT_SECRET);

        const res = await app.request(`/${TENANT_ID}/sentry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Sentry-Hook-Signature': sig,
            },
            body,
        });

        expect(res.status).toBe(200);
        const json = await res.json() as { ok: boolean };
        expect(json.ok).toBe(true);
    });

    it('returns 401 when Sentry-Hook-Signature is missing', async () => {
        const repo = makeMockSentryIntegrationRepo();
        const app = await buildApp(repo);
        const body = JSON.stringify({ action: 'triggered' });

        const res = await app.request(`/${TENANT_ID}/sentry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });

        expect(res.status).toBe(401);
    });

    it('returns 401 when body is tampered (signature no longer matches)', async () => {
        const repo = makeMockSentryIntegrationRepo();
        const app = await buildApp(repo);
        const originalBody = JSON.stringify({ action: 'triggered' });
        const tamperedBody = JSON.stringify({ action: 'tampered', extra: 'injected' });
        const sig = signBody(originalBody, CLIENT_SECRET); // signed against original

        const res = await app.request(`/${TENANT_ID}/sentry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Sentry-Hook-Signature': sig,
            },
            body: tamperedBody, // send tampered body
        });

        expect(res.status).toBe(401);
    });

    it('returns 401 when stored secret is wrong (integration mismatch)', async () => {
        const repo = makeMockSentryIntegrationRepo({ clientSecret: 'wrong-secret' });
        const app = await buildApp(repo);
        const body = JSON.stringify({ action: 'triggered' });
        const sig = signBody(body, CLIENT_SECRET); // signed with correct secret

        const res = await app.request(`/${TENANT_ID}/sentry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Sentry-Hook-Signature': sig,
            },
            body,
        });

        expect(res.status).toBe(401);
    });

    it('returns 401 when no integration is configured for this tenant (null secret)', async () => {
        const repo = makeMockSentryIntegrationRepo({ clientSecret: null });
        const app = await buildApp(repo);
        const body = JSON.stringify({ action: 'triggered' });
        const sig = signBody(body, CLIENT_SECRET);

        const res = await app.request(`/${TENANT_ID}/sentry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Sentry-Hook-Signature': sig,
            },
            body,
        });

        expect(res.status).toBe(401);
    });

    it('does NOT use X-Webhook-Signature or X-API-Key headers (Sentry-specific only)', async () => {
        const repo = makeMockSentryIntegrationRepo();
        const app = await buildApp(repo);
        const body = JSON.stringify({ action: 'triggered' });
        const sig = signBody(body, CLIENT_SECRET);

        // Provide correct Sentry-Hook-Signature but also wrong legacy headers
        const res = await app.request(`/${TENANT_ID}/sentry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Sentry-Hook-Signature': sig,
                'X-Webhook-Signature': 'wrong-legacy-sig',
                'X-API-Key': 'some-api-key',
            },
            body,
        });

        // Should still pass because it uses Sentry-Hook-Signature
        expect(res.status).toBe(200);
    });

    it('does not have sha256= prefix stripping (Sentry uses raw hex, no prefix)', async () => {
        const repo = makeMockSentryIntegrationRepo();
        const app = await buildApp(repo);
        const body = JSON.stringify({ action: 'triggered' });
        const sig = signBody(body, CLIENT_SECRET);
        // Sentry sends raw hex — confirm sha256= prefixed version fails
        const sigWithPrefix = `sha256=${sig}`;

        const res = await app.request(`/${TENANT_ID}/sentry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Sentry-Hook-Signature': sigWithPrefix,
            },
            body,
        });

        expect(res.status).toBe(401);
    });
});
