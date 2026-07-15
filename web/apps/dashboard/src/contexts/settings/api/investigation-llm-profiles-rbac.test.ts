/**
 * AC-088 — non-admin users cannot mutate Investigation LLM profiles.
 * BFF routes fail closed (403) before proxying to Core; GET remains allowed.
 */
import { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Role = 'admin' | 'member';
let currentRole: Role = 'admin';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (
    handler: (req: Request, ctx?: unknown, params?: Record<string, string>) => Promise<Response>,
    options: { adminOnly?: boolean } = {},
  ) => {
    return async (
      request: Request,
      routeContext?: { params?: Promise<Record<string, string>> },
    ) => {
      if (options.adminOnly && currentRole !== 'admin') {
        return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
      }
      const params = routeContext?.params ? await routeContext.params : undefined;
      return handler(request, {}, params);
    };
  },
}));

vi.mock('@/lib/api/get-backend-token', () => ({
  getBackendToken: vi.fn().mockResolvedValue('test-session-token'),
}));

describe('investigation-llm-profiles RBAC (AC-088)', () => {
  const CORE_URL = 'https://core-api.test';

  beforeEach(() => {
    process.env.CORE_API_URL = CORE_URL;
    currentRole = 'admin';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadHandlers() {
    vi.resetModules();
    const mod = await import('./investigation-llm-profiles-handler');
    return {
      GET: mod.GET as unknown as (req: Request) => Promise<Response>,
      POST: mod.POST as unknown as (req: Request) => Promise<Response>,
    };
  }

  async function loadIdHandlers() {
    vi.resetModules();
    const mod = await import('./investigation-llm-profile-id-handler');
    return {
      PATCH: mod.PATCH as unknown as (
        req: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>,
      DELETE: mod.DELETE as unknown as (
        req: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>,
    };
  }

  async function loadActivateHandler() {
    vi.resetModules();
    const mod = await import('./investigation-llm-profile-activate-handler');
    return {
      POST: mod.POST as unknown as (
        req: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>,
    };
  }

  it('member GET can list profiles (read-only)', async () => {
    currentRole = 'member';
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () => Promise.resolve(JSON.stringify({ activeProfileId: null, items: [] })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadHandlers();
    const res = await GET(new Request('http://localhost/api/settings/investigation-llm-profiles'));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('member POST create returns 403 without calling Core', async () => {
    currentRole = 'member';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadHandlers();
    const res = await POST(
      new Request('http://localhost/api/settings/investigation-llm-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'Blocked',
          baseUrl: 'http://127.0.0.1:8081/v1',
          model: 'blocked-model',
        }),
      }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Admin access required.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('member PATCH update returns 403 without calling Core', async () => {
    currentRole = 'member';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { PATCH } = await loadIdHandlers();
    const res = await PATCH(
      new Request('http://localhost/api/settings/investigation-llm-profiles/p1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Blocked edit' }),
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    );

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('member DELETE returns 403 without calling Core', async () => {
    currentRole = 'member';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { DELETE } = await loadIdHandlers();
    const res = await DELETE(
      new Request('http://localhost/api/settings/investigation-llm-profiles/p1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    );

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('member POST activate returns 403 without calling Core', async () => {
    currentRole = 'member';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadActivateHandler();
    const res = await POST(
      new Request('http://localhost/api/settings/investigation-llm-profiles/p1/activate', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    );

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
