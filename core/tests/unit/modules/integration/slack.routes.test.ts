import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createSlackRoutes } from '../../../../src/modules/integration/infra/slack.routes.js';
import type { SlackRouteDeps } from '../../../../src/modules/integration/infra/slack.routes.js';
import type { SlackConfigResponse } from '../../../../src/modules/tenant/domain/tenant.entity.js';

// ─── Mock deps ────────────────────────────────────────────────────────────────

function makeMockDeps(overrides: Partial<SlackRouteDeps> = {}): SlackRouteDeps {
  return {
    connectSlack: {
      execute: vi.fn(
        async () =>
          ({
            connected: true,
            channel: '#incidents',
            workspaceName: 'Acme Corp',
            installedAt: '2026-04-23T00:00:00.000Z',
          }) as SlackConfigResponse,
      ),
    },
    disconnectSlack: {
      execute: vi.fn(async () => undefined),
    },
    updateSlackConfig: {
      execute: vi.fn(
        async () =>
          ({
            connected: true,
            channel: '#alerts',
            workspaceName: 'Acme Corp',
            installedAt: '2026-04-23T00:00:00.000Z',
          }) as SlackConfigResponse,
      ),
    },
    tenantRepo: {
      findById: vi.fn(async () => null),
      create: vi.fn(),
      findBySlug: vi.fn(async () => null),
      findByCustomDomain: vi.fn(async () => null),
      update: vi.fn(),
      listByOwner: vi.fn(),
    },
    slackConfig: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://api.causeflow.io/v1/integrations/slack/oauth/callback',
      stateSecret: 'test-state-secret',
      signingSecret: 'test-signing-secret',
    },
    tokenEncryption: {
      encrypt: vi.fn(async (plaintext: string) => ({
        ciphertext: Buffer.from(`encrypted:${plaintext}`).toString('base64'),
        encryptedDek: Buffer.from('dek').toString('base64'),
        iv: Buffer.from('iv').toString('base64'),
        tag: Buffer.from('tag').toString('base64'),
      })),
      decrypt: vi.fn(async (payload) =>
        Buffer.from(payload.ciphertext, 'base64').toString('utf8').replace('encrypted:', ''),
      ),
    },
    ...overrides,
  };
}

// Helper to create a test app with tenant context injected
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeTestApp(deps: SlackRouteDeps): any {
  // Use a plain Hono app (no generic typing) to avoid test-only type incompatibilities
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
  const app = new (Hono as any)();
  // Inject tenant context as middleware
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
  app.use('*', async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    c.set('tenantId', 'tenant-test-001');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    c.set('userId', 'user-test-001');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    c.set('userRoles', ['admin']);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    c.set('userEmail', 'admin@test.com');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    c.set('requestId', 'req-test-001');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return next();
  });
  const slackRouter = createSlackRoutes(deps);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.route('/', slackRouter);
  return app;
}

describe('slack.routes', () => {
  let deps: SlackRouteDeps;
  let app: Hono;

  beforeEach(() => {
    deps = makeMockDeps();
    app = makeTestApp(deps);
  });

  // ─── GET /oauth/authorize ─────────────────────────────────────────────────

  describe('GET /oauth/authorize', () => {
    it('redirects to slack.com OAuth authorize URL', async () => {
      const res = await app.request('/oauth/authorize');
      expect(res.status).toBe(302);
      const location = res.headers.get('Location') ?? '';
      expect(location).toContain('slack.com/oauth/v2/authorize');
    });

    it('includes required OAuth params in redirect URL', async () => {
      const res = await app.request('/oauth/authorize');
      const location = res.headers.get('Location') ?? '';
      expect(location).toContain('client_id=test-client-id');
      expect(location).toContain('scope=incoming-webhook%2Cchat%3Awrite%2Cchannels%3Aread');
      expect(location).toContain('redirect_uri=');
      expect(location).toContain('state=');
    });
  });

  // ─── GET /config ──────────────────────────────────────────────────────────

  describe('GET /config', () => {
    it('returns {connected:false} when tenant has no slackConfig', async () => {
      vi.mocked(deps.tenantRepo.findById).mockResolvedValueOnce(null);
      const res = await app.request('/config');
      expect(res.status).toBe(200);
      const body = (await res.json()) as SlackConfigResponse;
      expect(body.connected).toBe(false);
    });

    it('returns config without accessToken or webhookUrl when connected', async () => {
      vi.mocked(deps.tenantRepo.findById).mockResolvedValueOnce({
        tenantId: 'tenant-test-001' as any,
        name: 'Test Corp',
        slug: 'test-corp',
        ownerEmail: 'admin@test.com',
        plan: 'pro',
        status: 'active',
        settings: {
          maxIncidentsPerMonth: 50,
          autoRemediation: false,
          notificationChannels: [],
          slackConfig: {
            accessToken: 'xoxb-SECRET-TOKEN',
            webhookUrl: 'https://hooks.slack.com/services/SECRET',
            channel: '#incidents',
            channelId: 'C1234567',
            workspaceId: 'T1234567',
            workspaceName: 'Acme Corp',
            installedAt: '2026-04-23T00:00:00.000Z',
          },
        } as any,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const res = await app.request('/config');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['connected']).toBe(true);
      expect(body['channel']).toBe('#incidents');
      expect(body['workspaceName']).toBe('Acme Corp');
      // SECURITY: sensitive fields must not appear
      expect(body['accessToken']).toBeUndefined();
      expect(body['webhookUrl']).toBeUndefined();
    });
  });

  // ─── PATCH /config ────────────────────────────────────────────────────────

  describe('PATCH /config', () => {
    it('returns 200 with valid channel format #alerts', async () => {
      const res = await app.request('/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: '#alerts' }),
      });
      expect(res.status).toBe(200);
    });

    it('returns 200 with valid channel format #incidents-prod', async () => {
      const res = await app.request('/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: '#incidents-prod' }),
      });
      expect(res.status).toBe(200);
    });

    it('returns 400 with invalid channel "incidents" (no leading #)', async () => {
      const res = await app.request('/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'incidents' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 with invalid channel "#UPPER" (uppercase)', async () => {
      const res = await app.request('/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: '#UPPER' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 with invalid channel "#" (too short)', async () => {
      const res = await app.request('/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: '#' }),
      });
      expect(res.status).toBe(400);
    });

    it('calls updateSlackConfig usecase with correct args', async () => {
      const res = await app.request('/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: '#alerts' }),
      });
      expect(res.status).toBe(200);
      expect(deps.updateSlackConfig.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-test-001',
        channel: '#alerts',
      });
    });
  });

  // ─── DELETE /oauth ────────────────────────────────────────────────────────

  describe('DELETE /oauth', () => {
    it('returns 204 on successful disconnect', async () => {
      const res = await app.request('/oauth', { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('calls disconnectSlack usecase', async () => {
      await app.request('/oauth', { method: 'DELETE' });
      expect(deps.disconnectSlack.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-test-001',
      });
    });
  });

  // ─── POST /test ───────────────────────────────────────────────────────────

  describe('POST /test', () => {
    it('returns 400 when Slack not configured for tenant', async () => {
      const res = await app.request('/test', { method: 'POST' });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['ok']).toBe(false);
      expect(body['error']).toBe('Slack not configured');
    });
  });
});
