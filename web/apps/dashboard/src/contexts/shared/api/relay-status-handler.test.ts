import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock withAuth to pass through the handler directly
vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: Function) => handler,
}));

// AC-042: capture dashLogger.error + Sentry.captureException on 5xx paths
const dashLoggerMock = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
vi.mock('@/lib/logger', () => ({ logger: dashLoggerMock }));

const sentryMock = { captureException: vi.fn() };
vi.mock('@sentry/nextjs', () => ({ default: sentryMock, ...sentryMock }));

// Mock getApiClient
const mockGetRelayStatus = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    getRelayStatus: mockGetRelayStatus,
  }),
}));

// Must import AFTER mocks
const { GET } = await import('./relay-status-handler');

const CTX = { userId: 'user_test', tenantId: 'tenant_test' };

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
    const response = await (GET as Function)(req, CTX);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockStatus);
    expect(mockGetRelayStatus).toHaveBeenCalledOnce();
  });

  it('returns the Core method return value directly', async () => {
    const req = makeRequest();
    const response = await (GET as Function)(req, CTX);
    const data = await response.json();

    expect(data).toEqual(mockStatus);
  });

  it('returns 502 when Core fails with a non-404 error (AC-042: logs + captures)', async () => {
    const boom = new Error('Core API unavailable');
    mockGetRelayStatus.mockRejectedValue(boom);

    const req = makeRequest();
    const response = await (GET as Function)(req, CTX);
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Core API unavailable');

    // AC-042: non-recoverable 5xx must log structured payload + forward to Sentry
    expect(dashLoggerMock.error).toHaveBeenCalledTimes(1);
    const payload = dashLoggerMock.error.mock.calls[0][0];
    expect(payload).toMatchObject({
      method: 'GET',
      path: '/api/relay/status',
      userId: 'user_test',
      tenantId: 'tenant_test',
      err: boom,
    });
    expect(typeof payload.duration).toBe('number');
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    expect(sentryMock.captureException.mock.calls[0][0]).toBe(boom);
    expect(sentryMock.captureException.mock.calls[0][1].extra).toMatchObject({
      method: 'GET',
      path: '/api/relay/status',
      userId: 'user_test',
      tenantId: 'tenant_test',
    });
  });

  it('returns 200 with a disconnected default when Core returns 404 (AC-042: no capture)', async () => {
    // The staging Core API currently returns 404 for /v1/relay/status because
    // the endpoint is not deployed. Handler must degrade gracefully so the UI
    // can render its "not connected" empty state.
    mockGetRelayStatus.mockRejectedValue(new Error('Not Found'));

    const req = makeRequest();
    const response = await (GET as Function)(req, CTX);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: false, resources: [] });

    // AC-042: graceful-degrade (not-found) branch is intentional — must NOT capture
    expect(dashLoggerMock.error).not.toHaveBeenCalled();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
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
