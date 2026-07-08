/**
 * Sprint 3 — locks the PATCH /api/settings routing contract.
 *
 * Routing rule under test (from PRD §13 + INVARIANTS.md "/api/settings Routing Rule"):
 *   - `theme`, `locale`, `notifications`  → `updateUserSettings(ctx.userId, ...)`
 *   - `name`, `companyName`, `websiteUrl` → `updateTenant(ctx.tenantId, ...)`
 *   - Both kinds in one request           → both clients called via Promise.all
 *   - Non-admin + company fields          → 403, zero client calls
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const updateUserSettings = vi.fn();
const updateTenant = vi.fn();
const getUserProfile = vi.fn();
const getTenant = vi.fn();

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    updateUserSettings,
    updateTenant,
    getUserProfile,
    getTenant,
  }),
}));

// AC-042: capture dashLogger.error + Sentry.captureException on 5xx paths
const dashLoggerMock = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
vi.mock('@/lib/logger', () => ({ logger: dashLoggerMock }));

const sentryMock = { captureException: vi.fn() };
vi.mock('@sentry/nextjs', () => ({ default: sentryMock, ...sentryMock }));

// ctx shape is mutated per-test so we can exercise admin vs member.
type Role = 'admin' | 'member';
let currentRole: Role = 'admin';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth:
    (fn: (req: NextRequest, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: NextRequest, _routeCtx: { params: Promise<Record<string, string>> }) =>
      fn(req, {
        userId: 'user_test',
        tenantId: 'tenant_test',
        email: 'test@example.com',
        name: 'Test User',
        role: currentRole,
        profileComplete: true,
      }),
}));

beforeEach(() => {
  updateUserSettings.mockReset();
  updateTenant.mockReset();
  getUserProfile.mockReset();
  getTenant.mockReset();
  dashLoggerMock.error.mockClear();
  sentryMock.captureException.mockClear();
  currentRole = 'admin';
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function importHandler() {
  return await import('./settings-handler');
}

function patchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3001/api/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Next.js 15 RouteContext shape — non-dynamic routes still receive a resolved Promise
const ROUTE_CTX = { params: Promise.resolve({}) };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PATCH /api/settings — routing rule', () => {
  it('case A — user-only: {locale} calls only updateUserSettings', async () => {
    updateUserSettings.mockResolvedValueOnce({
      theme: 'system',
      locale: 'pt-br',
      notifications: {
        emailOnComplete: true,
        emailOnError: true,
        slackOnComplete: false,
        slackOnError: true,
      },
      createdAt: '2026-04-16T00:00:00Z',
      updatedAt: '2026-04-16T00:00:00Z',
    });

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ locale: 'pt-br' }), ROUTE_CTX);

    expect(res.status).toBe(200);
    expect(updateUserSettings).toHaveBeenCalledTimes(1);
    expect(updateUserSettings).toHaveBeenCalledWith('user_test', { locale: 'pt-br' });
    expect(updateTenant).not.toHaveBeenCalled();

    const body = (await res.json()) as { settings: { locale: string } };
    expect(body.settings.locale).toBe('pt-br');
  });

  it('case A.1 — user-only: {theme} routes to updateUserSettings, not updateTenant', async () => {
    updateUserSettings.mockResolvedValueOnce({
      theme: 'dark',
      locale: 'en',
      notifications: {
        emailOnComplete: true,
        emailOnError: true,
        slackOnComplete: false,
        slackOnError: true,
      },
      createdAt: '2026-04-16T00:00:00Z',
      updatedAt: '2026-04-16T00:00:00Z',
    });

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ theme: 'dark' }), ROUTE_CTX);

    expect(res.status).toBe(200);
    expect(updateUserSettings).toHaveBeenCalledTimes(1);
    expect(updateUserSettings).toHaveBeenCalledWith('user_test', { theme: 'dark' });
    expect(updateTenant).not.toHaveBeenCalled();
  });

  it('case A.2 — user-only: {notifications} routes to updateUserSettings', async () => {
    updateUserSettings.mockResolvedValueOnce({
      theme: 'system',
      locale: 'en',
      notifications: {
        emailOnComplete: false,
        emailOnError: true,
        slackOnComplete: false,
        slackOnError: true,
      },
      createdAt: '2026-04-16T00:00:00Z',
      updatedAt: '2026-04-16T00:00:00Z',
    });

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ notifications: { emailOnComplete: false } }), ROUTE_CTX);

    expect(res.status).toBe(200);
    expect(updateUserSettings).toHaveBeenCalledTimes(1);
    expect(updateUserSettings).toHaveBeenCalledWith('user_test', {
      notifications: {
        emailOnComplete: false,
        emailOnError: true,
        slackOnComplete: false,
        slackOnError: true,
      },
    });
    expect(updateTenant).not.toHaveBeenCalled();
  });

  it('case B — tenant-only (admin): {companyName} calls only updateTenant', async () => {
    currentRole = 'admin';
    updateTenant.mockResolvedValueOnce({
      id: 'tenant_test',
      name: 'Acme',
      plan: 'free',
    });

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ companyName: 'Acme' }), ROUTE_CTX);

    expect(res.status).toBe(200);
    expect(updateTenant).toHaveBeenCalledTimes(1);
    expect(updateTenant).toHaveBeenCalledWith('tenant_test', { name: 'Acme' });
    expect(updateUserSettings).not.toHaveBeenCalled();

    const body = (await res.json()) as { settings: { name: string } };
    expect(body.settings.name).toBe('Acme');
  });

  it('case B.1 — tenant-only: {name} (profile name) routes to updateTenant as userName', async () => {
    // `name` is the user's profile name — it maps to `userName` on the tenant
    // (legacy behavior preserved from pre-Sprint-3 handler).
    updateTenant.mockResolvedValueOnce({ id: 'tenant_test', name: 'irrelevant', plan: 'free' });

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ name: 'Alice Doe' }), ROUTE_CTX);

    expect(res.status).toBe(200);
    expect(updateTenant).toHaveBeenCalledTimes(1);
    expect(updateTenant).toHaveBeenCalledWith('tenant_test', { userName: 'Alice Doe' });
    expect(updateUserSettings).not.toHaveBeenCalled();
  });

  it('case C — both (admin): {locale, companyName} calls BOTH clients', async () => {
    currentRole = 'admin';
    updateUserSettings.mockResolvedValueOnce({
      theme: 'system',
      locale: 'pt-br',
      notifications: {
        emailOnComplete: true,
        emailOnError: true,
        slackOnComplete: false,
        slackOnError: true,
      },
      createdAt: '2026-04-16T00:00:00Z',
      updatedAt: '2026-04-16T00:00:00Z',
    });
    updateTenant.mockResolvedValueOnce({
      id: 'tenant_test',
      name: 'Acme',
      plan: 'free',
    });

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ locale: 'pt-br', companyName: 'Acme' }), ROUTE_CTX);

    expect(res.status).toBe(200);
    expect(updateUserSettings).toHaveBeenCalledTimes(1);
    expect(updateUserSettings).toHaveBeenCalledWith('user_test', { locale: 'pt-br' });
    expect(updateTenant).toHaveBeenCalledTimes(1);
    expect(updateTenant).toHaveBeenCalledWith('tenant_test', { name: 'Acme' });

    // Merged response shape includes both the tenant fields and the user-settings fields.
    const body = (await res.json()) as { settings: Record<string, unknown> };
    expect(body.settings.name).toBe('Acme');
    expect(body.settings.locale).toBe('pt-br');
  });

  it('case C.err — both: if updateUserSettings rejects, return 502 and surface error (AC-042: logs + captures)', async () => {
    const boom = new Error('user settings boom');
    currentRole = 'admin';
    updateUserSettings.mockRejectedValueOnce(boom);
    updateTenant.mockResolvedValueOnce({ id: 'tenant_test', name: 'Acme', plan: 'free' });

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ locale: 'pt-br', companyName: 'Acme' }), ROUTE_CTX);

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('user settings boom');

    // AC-042: non-recoverable 502 must log structured payload + forward to Sentry
    expect(dashLoggerMock.error).toHaveBeenCalledTimes(1);
    const payload = dashLoggerMock.error.mock.calls[0][0];
    expect(payload).toMatchObject({
      method: 'PATCH',
      path: '/api/settings',
      userId: 'user_test',
      tenantId: 'tenant_test',
      err: boom,
    });
    expect(typeof payload.duration).toBe('number');
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    expect(sentryMock.captureException.mock.calls[0][0]).toBe(boom);
    expect(sentryMock.captureException.mock.calls[0][1].extra).toMatchObject({
      method: 'PATCH',
      path: '/api/settings',
      userId: 'user_test',
      tenantId: 'tenant_test',
    });
  });

  it('case C.err.2 — both: if updateTenant rejects, return 502 and surface error', async () => {
    currentRole = 'admin';
    updateUserSettings.mockResolvedValueOnce({
      theme: 'system',
      locale: 'pt-br',
      notifications: {
        emailOnComplete: true,
        emailOnError: true,
        slackOnComplete: false,
        slackOnError: true,
      },
      createdAt: '2026-04-16T00:00:00Z',
      updatedAt: '2026-04-16T00:00:00Z',
    });
    updateTenant.mockRejectedValueOnce(new Error('tenant boom'));

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ locale: 'pt-br', companyName: 'Acme' }), ROUTE_CTX);

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('tenant boom');
  });

  it('case D — neither / empty body: PATCH {} calls no clients, returns 200', async () => {
    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({}), ROUTE_CTX);

    expect(res.status).toBe(200);
    expect(updateUserSettings).not.toHaveBeenCalled();
    expect(updateTenant).not.toHaveBeenCalled();

    const body = (await res.json()) as { settings: Record<string, unknown> };
    expect(body.settings).toEqual({});
  });

  it('case E — non-admin + {companyName}: returns 403 with ZERO client calls', async () => {
    currentRole = 'member';

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ companyName: 'Acme' }), ROUTE_CTX);

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Admin access required.');

    // Security-critical assertion: neither client was touched.
    expect(updateUserSettings).not.toHaveBeenCalled();
    expect(updateTenant).not.toHaveBeenCalled();
  });

  it('case E.1 — non-admin + {websiteUrl}: returns 403 with ZERO client calls', async () => {
    currentRole = 'member';

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ websiteUrl: 'https://acme.test' }), ROUTE_CTX);

    expect(res.status).toBe(403);
    expect(updateUserSettings).not.toHaveBeenCalled();
    expect(updateTenant).not.toHaveBeenCalled();
  });

  it('case E.2 — non-admin can still update their own user settings (locale)', async () => {
    currentRole = 'member';
    updateUserSettings.mockResolvedValueOnce({
      theme: 'system',
      locale: 'pt-br',
      notifications: {
        emailOnComplete: true,
        emailOnError: true,
        slackOnComplete: false,
        slackOnError: true,
      },
      createdAt: '2026-04-16T00:00:00Z',
      updatedAt: '2026-04-16T00:00:00Z',
    });

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ locale: 'pt-br' }), ROUTE_CTX);

    expect(res.status).toBe(200);
    expect(updateUserSettings).toHaveBeenCalledTimes(1);
    expect(updateTenant).not.toHaveBeenCalled();
  });

  it('preserves trimming: {companyName: "  Acme  "} → updateTenant gets "Acme"', async () => {
    currentRole = 'admin';
    updateTenant.mockResolvedValueOnce({ id: 'tenant_test', name: 'Acme', plan: 'free' });

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ companyName: '  Acme  ' }), ROUTE_CTX);

    expect(res.status).toBe(200);
    expect(updateTenant).toHaveBeenCalledWith('tenant_test', { name: 'Acme' });
  });

  it('preserves websiteUrl normalization: empty string → undefined', async () => {
    currentRole = 'admin';
    updateTenant.mockResolvedValueOnce({ id: 'tenant_test', name: 'x', plan: 'free' });

    const { PATCH } = await importHandler();
    const res = await PATCH(patchRequest({ websiteUrl: '   ' }), ROUTE_CTX);

    expect(res.status).toBe(200);
    expect(updateTenant).toHaveBeenCalledWith('tenant_test', { websiteUrl: undefined });
  });
});
