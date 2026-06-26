import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock withAuth to pass through the handler directly
vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: Function) => handler,
}));

// Mock getApiClient
const mockGetRelayStatus = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    getRelayStatus: mockGetRelayStatus,
  }),
}));

// Must import AFTER mocks
const { GET } = await import('./relay-status-handler');

function makeRequest(url = 'http://localhost:3001/api/relay/status'): Request {
  return new Request(url, { method: 'GET' });
}

describe('relay-status-handler', () => {
  const mockStatus = {
    connected: true,
    version: '1.2.3',
    lastPingAt: '2026-04-07T12:00:00Z',
  };

  beforeEach(() => {
    mockGetRelayStatus.mockResolvedValue(mockStatus);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with relay status', async () => {
    const req = makeRequest();
    const response = await (GET as Function)(req, {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockStatus);
    expect(mockGetRelayStatus).toHaveBeenCalledOnce();
  });

  it('returns the Core method return value directly', async () => {
    const req = makeRequest();
    const response = await (GET as Function)(req, {});
    const data = await response.json();

    expect(data).toEqual(mockStatus);
  });

  it('returns 502 when Core fails with a non-404 error', async () => {
    mockGetRelayStatus.mockRejectedValue(new Error('Core API unavailable'));

    const req = makeRequest();
    const response = await (GET as Function)(req, {});
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Core API unavailable');
  });

  it('returns 200 with a disconnected default when Core returns 404', async () => {
    // The staging Core API currently returns 404 for /v1/relay/status because
    // the endpoint is not deployed. Handler must degrade gracefully so the UI
    // can render its "not connected" empty state.
    mockGetRelayStatus.mockRejectedValue(new Error('Not Found'));

    const req = makeRequest();
    const response = await (GET as Function)(req, {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: false, resources: [] });
  });
});

describe('relay-status-handler — auth contract', () => {
  it('withAuth is used to wrap the handler', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./relay-status-handler.ts', import.meta.url), 'utf-8');
    expect(source).toContain('withAuth');
    expect(source).toContain('getRelayStatus');
  });
});
