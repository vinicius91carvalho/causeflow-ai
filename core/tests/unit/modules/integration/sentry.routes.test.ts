import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createIntegrationRoutes } from '../../../../src/modules/integration/infra/integration.routes.js';
import type { IntegrationUseCases } from '../../../../src/modules/integration/infra/integration.routes.js';
import type { GetSentryIntegrationStatusUseCase } from '../../../../src/modules/integration/application/get-sentry-integration-status.usecase.js';
import type { ConnectCredentialUseCase } from '../../../../src/modules/integration/application/connect-credential.usecase.js';
import type { DisconnectIntegrationUseCase } from '../../../../src/modules/integration/application/disconnect-integration.usecase.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal stub for required use cases (non-sentry paths) */
function makeBaseDeps(): Pick<IntegrationUseCases, 'connectCredential' | 'disconnectIntegration' | 'listAllIntegrations'> {
    return {
        connectCredential: { execute: vi.fn(async () => ({})) } as unknown as ConnectCredentialUseCase,
        disconnectIntegration: { execute: vi.fn(async () => ({})) } as unknown as DisconnectIntegrationUseCase,
        listAllIntegrations: { execute: vi.fn(async () => []) },
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeTestApp(useCases: IntegrationUseCases): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
    const app = new (Hono as any)();
    // Inject tenant + auth context so route guards pass
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
    app.use('*', async (c: any, next: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        c.set('tenantId', 'tenant-sentry-route-001');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        c.set('userId', 'user-admin-001');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        c.set('userRoles', ['admin']);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        c.set('userEmail', 'admin@test.com');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        c.set('requestId', 'req-sentry-test-001');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return next();
    });
    const router = createIntegrationRoutes(useCases);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    app.route('/', router);
    return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /sentry — route response shape', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns hasClientSecret=false when no secret is configured', async () => {
        const getSentryIntegrationStatus = {
            execute: vi.fn(async () => ({
                configured: false,
                verified: false,
                verifiedAt: null,
                lastEventAt: null,
            })),
        } as unknown as GetSentryIntegrationStatusUseCase;
        const app = makeTestApp({ ...makeBaseDeps(), getSentryIntegrationStatus });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const res = await app.request('/sentry');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const body = await res.json();

        expect(res.status).toBe(200);
        // Route must map domain `configured` → API `hasClientSecret`
        expect(body).toHaveProperty('hasClientSecret', false);
        expect(body).toHaveProperty('verified', false);
        expect(body).toHaveProperty('verifiedAt', null);
        expect(body).toHaveProperty('lastEventAt', null);
    });

    it('returns hasClientSecret=true after a client secret has been saved', async () => {
        const getSentryIntegrationStatus = {
            execute: vi.fn(async () => ({
                configured: true,
                verified: false,
                verifiedAt: null,
                lastEventAt: null,
            })),
        } as unknown as GetSentryIntegrationStatusUseCase;
        const app = makeTestApp({ ...makeBaseDeps(), getSentryIntegrationStatus });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const res = await app.request('/sentry');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const body = await res.json();

        expect(res.status).toBe(200);
        // This is the key assertion — the UI reads `hasClientSecret`, not `configured`
        expect(body).toHaveProperty('hasClientSecret', true);
        expect(body).toHaveProperty('verified', false);
    });

    it('does not expose the raw `configured` field in the API response', async () => {
        const getSentryIntegrationStatus = {
            execute: vi.fn(async () => ({
                configured: true,
                verified: true,
                verifiedAt: '2026-04-27T10:00:00.000Z',
                lastEventAt: '2026-04-27T10:00:00.000Z',
            })),
        } as unknown as GetSentryIntegrationStatusUseCase;
        const app = makeTestApp({ ...makeBaseDeps(), getSentryIntegrationStatus });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const res = await app.request('/sentry');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const body = await res.json();

        expect(res.status).toBe(200);
        // `configured` is a domain-layer field — it must not leak into the HTTP API
        expect(body).not.toHaveProperty('configured');
        expect(body).toHaveProperty('hasClientSecret', true);
        expect(body).toHaveProperty('verified', true);
    });

    it('returns 503 when getSentryIntegrationStatus use case is not configured', async () => {
        const app = makeTestApp({ ...makeBaseDeps() }); // no getSentryIntegrationStatus

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const res = await app.request('/sentry');

        expect(res.status).toBe(503);
    });
});
