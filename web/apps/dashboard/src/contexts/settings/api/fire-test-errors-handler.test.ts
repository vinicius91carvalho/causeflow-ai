import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock withAuth to pass through the handler directly
vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: Request) => Promise<Response>) => handler,
}));

// Mock getBackendToken
vi.mock('@/lib/api/get-backend-token', () => ({
  getBackendToken: vi.fn().mockResolvedValue('test-clerk-token'),
}));

describe('fire-test-errors-handler — proxy to core', () => {
  const CORE_URL = 'https://core-api.test';

  beforeEach(() => {
    process.env.CORE_API_URL = CORE_URL;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadPOST() {
    // Dynamic import ensures env var is set before the module runs
    vi.resetModules();
    const mod = await import('./fire-test-errors-handler');
    return mod.POST as unknown as (req: Request) => Promise<Response>;
  }

  it('Fix 1: proxies POST to CORE_API_URL/v1/admin/fire-test-errors with Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 500,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () =>
        Promise.resolve(JSON.stringify({ error: 'TestErrorFired', traceId: 'trace-123' })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const POST = await loadPOST();
    const req = new Request('http://localhost/api/admin/fire-test-errors', { method: 'POST' });
    await (POST as (req: Request) => Promise<Response>)(req);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    // Fix 1: URL MUST include /v1 prefix
    expect(url).toBe(`${CORE_URL}/v1/admin/fire-test-errors`);
    expect(url).toContain('/v1/admin/fire-test-errors');
    expect((init as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer test-clerk-token',
    );
    expect((init as RequestInit).method).toBe('POST');
  });

  it('passes through HTTP 500 + TestErrorFired body unchanged', async () => {
    const coreBody = JSON.stringify({ error: 'TestErrorFired', traceId: 'trace-abc' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: () => Promise.resolve(coreBody),
      }),
    );

    const POST = await loadPOST();
    const req = new Request('http://localhost/api/admin/fire-test-errors', { method: 'POST' });
    const res = await (POST as (req: Request) => Promise<Response>)(req);

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; traceId: string };
    expect(body.error).toBe('TestErrorFired');
    expect(body.traceId).toBe('trace-abc');
  });

  it('passes through HTTP 200 OK from core unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: () => Promise.resolve(JSON.stringify({ ok: true })),
      }),
    );

    const POST = await loadPOST();
    const req = new Request('http://localhost/api/admin/fire-test-errors', { method: 'POST' });
    const res = await (POST as (req: Request) => Promise<Response>)(req);

    expect(res.status).toBe(200);
  });

  it('does NOT include tenantId in the request body or query string (W4 invariant)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 500,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () => Promise.resolve(JSON.stringify({ error: 'TestErrorFired', traceId: 'x' })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const POST = await loadPOST();
    const req = new Request('http://localhost/api/admin/fire-test-errors', { method: 'POST' });
    await (POST as (req: Request) => Promise<Response>)(req);

    const [url, init] = fetchMock.mock.calls[0];
    // No tenantId in the URL
    expect(url).not.toContain('tenantId');
    // No tenantId in the body
    const reqBody = (init as RequestInit).body;
    if (reqBody) {
      expect(String(reqBody)).not.toContain('tenantId');
    }
  });

  it('Fix 4: forwards upstream headers including traceparent (AD-8 passthrough)', async () => {
    const upstreamHeaders = new Headers({
      'Content-Type': 'application/json',
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      'x-request-id': 'req-abc-123',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        headers: upstreamHeaders,
        text: () =>
          Promise.resolve(JSON.stringify({ error: 'TestErrorFired', traceId: 'trace-abc' })),
      }),
    );

    const POST = await loadPOST();
    const req = new Request('http://localhost/api/admin/fire-test-errors', { method: 'POST' });
    const res = await (POST as (req: Request) => Promise<Response>)(req);

    // traceparent and x-request-id must be forwarded
    expect(res.headers.get('traceparent')).toBe(
      '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    );
    expect(res.headers.get('x-request-id')).toBe('req-abc-123');
    // Content-Type must still be application/json
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('Fix 4: sets Content-Type application/json when upstream omits it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        headers: new Headers({}), // no Content-Type
        text: () => Promise.resolve(JSON.stringify({ error: 'TestErrorFired', traceId: 'y' })),
      }),
    );

    const POST = await loadPOST();
    const req = new Request('http://localhost/api/admin/fire-test-errors', { method: 'POST' });
    const res = await (POST as (req: Request) => Promise<Response>)(req);

    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns HTTP 502 when CORE_API_URL is not set', async () => {
    delete process.env.CORE_API_URL;
    vi.resetModules();

    // Re-mock after resetModules
    vi.mock('@/lib/api/with-auth', () => ({
      withAuth: (handler: (req: Request) => Promise<Response>) => handler,
    }));
    vi.mock('@/lib/api/get-backend-token', () => ({
      getBackendToken: vi.fn().mockResolvedValue('test-clerk-token'),
    }));

    const mod = await import('./fire-test-errors-handler');
    const POST = mod.POST as unknown as (req: Request) => Promise<Response>;

    const req = new Request('http://localhost/api/admin/fire-test-errors', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('CORE_API_URL');
  });
});
