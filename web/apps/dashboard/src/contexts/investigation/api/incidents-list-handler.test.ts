import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal route handler shape for test-only casts. Uses unknown-based
// generic so callers can pass a plain Request — the real NextRequest carries
// Next-specific fields we don't need in unit tests.
type RouteHandler = (req: unknown, ctx?: unknown) => Promise<Response>;

// Mock withAuth to pass through the handler directly
vi.mock('@/lib/api/with-auth', () => ({
  withAuth: <T>(handler: T): T => handler,
}));

// Mock getApiClient
const mockListIncidents = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    listIncidents: mockListIncidents,
  }),
}));

// Must import AFTER mocks
const { GET } = await import('./incidents-list-handler');

function makeRequest(url = 'http://localhost:3001/api/incidents'): Request {
  return new Request(url, { method: 'GET' });
}

describe('incidents-list-handler', () => {
  const mockResult = {
    items: [
      {
        incidentId: 'inc-1',
        title: 'DB latency spike',
        status: 'open',
        severity: 'high',
        createdAt: '2026-04-07T00:00:00Z',
      },
    ],
    cursor: null,
  };

  beforeEach(() => {
    mockListIncidents.mockResolvedValue(mockResult);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with incidents list', async () => {
    const req = makeRequest();
    const response = await (GET as RouteHandler)(req, {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockResult);
  });

  it('forwards ?status query param to listIncidents', async () => {
    const req = makeRequest('http://localhost:3001/api/incidents?status=active');
    await (GET as RouteHandler)(req, {});

    expect(mockListIncidents).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
  });

  it('forwards ?limit query param to listIncidents', async () => {
    const req = makeRequest('http://localhost:3001/api/incidents?limit=10');
    await (GET as RouteHandler)(req, {});

    expect(mockListIncidents).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });

  it('returns the Core method return value directly', async () => {
    const req = makeRequest();
    const response = await (GET as RouteHandler)(req, {});
    const data = await response.json();

    expect(data).toEqual(mockResult);
  });

  it('propagates errors from listIncidents', async () => {
    mockListIncidents.mockRejectedValue(new Error('Core API unavailable'));

    const req = makeRequest();
    await expect((GET as RouteHandler)(req, {})).rejects.toThrow('Core API unavailable');
  });
});

describe('incidents-list-handler — auth contract', () => {
  it('withAuth is used to wrap the handler', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./incidents-list-handler.ts', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('withAuth');
    expect(source).toContain('listIncidents');
  });
});
