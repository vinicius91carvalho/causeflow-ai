import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: Request) => Promise<Response>) => handler,
}));

vi.mock('@/lib/api/get-backend-token', () => ({
  getBackendToken: vi.fn().mockResolvedValue('test-session-token'),
}));

describe('investigation-llm-profiles-handler — proxy to Core (AC-084)', () => {
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
    };
  }

  it('GET proxies to CORE_API_URL/v1/oss/investigation-llm-profiles with Bearer token', async () => {
    const body = JSON.stringify({
      items: [
        { id: 'p1', label: 'Local Ornith', baseUrl: 'http://127.0.0.1:8081/v1', model: 'Ornith' },
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
});
