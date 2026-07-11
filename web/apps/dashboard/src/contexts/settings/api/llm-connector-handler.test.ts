import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: Request) => Promise<Response>) => handler,
}));

vi.mock('@/lib/api/get-backend-token', () => ({
  getBackendToken: vi.fn().mockResolvedValue('test-session-token'),
}));

describe('llm-connector-handler — proxy to Core (AC-059)', () => {
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
    const mod = await import('./llm-connector-handler');
    return {
      GET: mod.GET as unknown as (req: Request) => Promise<Response>,
      PUT: mod.PUT as unknown as (req: Request) => Promise<Response>,
    };
  }

  it('GET proxies to CORE_API_URL/v1/oss/llm-connector with Bearer token', async () => {
    const body = JSON.stringify({
      active: { id: 'ornith', model: 'Ornith-1.0-9B-code' },
      options: [{ id: 'ornith' }, { id: 'deepseek-opencode' }],
      contextOverflowCode: 'LLM_CONTEXT_TOO_LARGE',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () => Promise.resolve(body),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadHandlers();
    const res = await GET(new Request('http://localhost/api/settings/llm-connector'));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CORE_URL}/v1/oss/llm-connector`);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-session-token',
    );
    expect(init.method).toBe('GET');
    const json = (await res.json()) as { active: { id: string }; contextOverflowCode: string };
    expect(json.active.id).toBe('ornith');
    expect(json.contextOverflowCode).toBe('LLM_CONTEXT_TOO_LARGE');
  });

  it('PUT proxies connector selection to Core', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () =>
        Promise.resolve(
          JSON.stringify({
            active: { id: 'deepseek-opencode', model: 'deepseek-v4-flash-free' },
          }),
        ),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { PUT } = await loadHandlers();
    const res = await PUT(
      new Request('http://localhost/api/settings/llm-connector', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connector: 'deepseek-opencode' }),
      }),
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CORE_URL}/v1/oss/llm-connector`);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ connector: 'deepseek-opencode' }));
  });

  it('PUT rejects unknown connector ids without calling Core', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { PUT } = await loadHandlers();
    const res = await PUT(
      new Request('http://localhost/api/settings/llm-connector', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connector: 'anthropic' }),
      }),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 when CORE_API_URL is unset', async () => {
    delete process.env.CORE_API_URL;
    const { GET } = await loadHandlers();
    const res = await GET(new Request('http://localhost/api/settings/llm-connector'));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('CORE_API_URL');
  });
});
