import { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (
    handler: (req: Request, ctx?: unknown, params?: Record<string, string>) => Promise<Response>,
  ) => {
    return async (
      request: Request,
      routeContext?: { params?: Promise<Record<string, string>> },
    ) => {
      const params = routeContext?.params ? await routeContext.params : undefined;
      return handler(request, {}, params);
    };
  },
}));

vi.mock('@/lib/api/get-backend-token', () => ({
  getBackendToken: vi.fn().mockResolvedValue('test-session-token'),
}));

describe('investigation-llm-profiles-handler — proxy to Core (AC-084, AC-085, AC-086)', () => {
  const CORE_URL = 'https://core-api.test';

  beforeEach(() => {
    process.env.CORE_API_URL = CORE_URL;
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
      redactInvestigationLlmPayload: mod.redactInvestigationLlmPayload,
      validateUpdateInput: mod.validateUpdateInput,
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

  it('GET proxies to CORE_API_URL/v1/oss/investigation-llm-profiles with Bearer token', async () => {
    const body = JSON.stringify({
      items: [
        {
          id: 'p1',
          label: 'Local Ornith',
          baseUrl: 'http://127.0.0.1:8081/v1',
          model: 'Ornith',
          apiKeyConfigured: true,
        },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () => Promise.resolve(body),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadHandlers();
    const res = await GET(new Request('http://localhost/api/settings/investigation-llm-profiles'));
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CORE_URL}/v1/oss/investigation-llm-profiles`);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-session-token',
    );
    expect(init.method).toBe('GET');
    const json = await res.json();
    expect(json.items[0].apiKeyConfigured).toBe(true);
    expect(json.items[0].apiKey).toBeUndefined();
  });

  it('GET redacts leaked apiKey fields from upstream', async () => {
    const body = JSON.stringify({
      items: [
        {
          id: 'p1',
          label: 'Leaky',
          baseUrl: 'http://127.0.0.1:8081/v1',
          model: 'Ornith',
          apiKey: 'sk-secret-should-not-leak',
        },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () => Promise.resolve(body),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadHandlers();
    const res = await GET(new Request('http://localhost/api/settings/investigation-llm-profiles'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items[0].apiKey).toBeUndefined();
    expect(json.items[0].apiKeyConfigured).toBe(true);
  });

  it('POST proxies create payload to Core', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () =>
        Promise.resolve(
          JSON.stringify({
            id: 'p1',
            label: 'Custom',
            baseUrl: 'http://127.0.0.1:8081/v1',
            model: 'test-model',
            apiKeyConfigured: true,
          }),
        ),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadHandlers();
    const res = await POST(
      new Request('http://localhost/api/settings/investigation-llm-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'Custom',
          baseUrl: 'http://127.0.0.1:8081/v1',
          model: 'test-model',
          apiKey: 'sk-test',
          contextWindowTokens: 32768,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({
        label: 'Custom',
        baseUrl: 'http://127.0.0.1:8081/v1',
        model: 'test-model',
        apiKey: 'sk-test',
        contextWindowTokens: 32768,
      }),
    );
  });

  it('POST rejects missing required fields without calling Core', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await loadHandlers();
    const res = await POST(
      new Request('http://localhost/api/settings/investigation-llm-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Only label' }),
      }),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PATCH proxies update payload to Core profile id path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () =>
        Promise.resolve(
          JSON.stringify({
            id: 'p1',
            label: 'Updated',
            baseUrl: 'http://127.0.0.1:9000/v1',
            model: 'new-model',
            apiKeyConfigured: true,
          }),
        ),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { PATCH } = await loadIdHandlers();
    const res = await PATCH(
      new Request('http://localhost/api/settings/investigation-llm-profiles/p1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'Updated',
          baseUrl: 'http://127.0.0.1:9000/v1',
          model: 'new-model',
        }),
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CORE_URL}/v1/oss/investigation-llm-profiles/p1`);
    expect(init.method).toBe('PATCH');
    const json = await res.json();
    expect(json.label).toBe('Updated');
    expect(json.apiKey).toBeUndefined();
  });

  it('POST activate proxies to Core profile activate path (AC-086)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () =>
        Promise.resolve(
          JSON.stringify({
            activeProfileId: 'p-active',
            profile: {
              id: 'p-active',
              label: 'Active Profile',
              baseUrl: 'http://127.0.0.1:8082/v1',
              model: 'active-model',
              apiKeyConfigured: false,
              isActive: true,
            },
          }),
        ),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadActivateHandler();
    const res = await POST(
      new Request('http://localhost/api/settings/investigation-llm-profiles/p-active/activate', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'p-active' }) },
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CORE_URL}/v1/oss/investigation-llm-profiles/p-active/activate`);
    expect(init.method).toBe('POST');
    const json = await res.json();
    expect(json.activeProfileId).toBe('p-active');
    expect(json.profile.isActive).toBe(true);
  });

  it('DELETE proxies to Core profile id path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () => Promise.resolve(JSON.stringify({ success: true, id: 'p2' })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { DELETE } = await loadIdHandlers();
    const res = await DELETE(
      new Request('http://localhost/api/settings/investigation-llm-profiles/p2', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'p2' }) },
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CORE_URL}/v1/oss/investigation-llm-profiles/p2`);
    expect(init.method).toBe('DELETE');
  });

  it('validateUpdateInput rejects empty patch bodies', async () => {
    const { validateUpdateInput } = await loadHandlers();
    const result = validateUpdateInput({});
    expect(result).toEqual({ error: 'At least one field is required to update a profile' });
  });

  it('redactInvestigationLlmPayload strips apiKeyEncrypted from upstream payloads', async () => {
    const { redactInvestigationLlmPayload } = await loadHandlers();
    const res = await redactInvestigationLlmPayload(
      NextResponse.json({ id: 'p1', apiKeyEncrypted: { iv: 'x' }, apiKeyConfigured: true }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.apiKeyEncrypted).toBeUndefined();
    expect(json.apiKeyConfigured).toBe(true);
  });
});
