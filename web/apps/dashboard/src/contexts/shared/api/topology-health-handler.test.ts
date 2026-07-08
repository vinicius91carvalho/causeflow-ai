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
const mockGetSystemHealth = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    getSystemHealth: mockGetSystemHealth,
  }),
}));

// Must import AFTER mocks
const { GET } = await import('./topology-health-handler');

const CTX = { userId: 'user_test', tenantId: 'tenant_test' };

function makeRequest(url = 'http://localhost:3001/api/topology/health'): Request {
  return new Request(url, { method: 'GET' });
}

describe('topology-health-handler', () => {
  const currentShape = {
    totalServices: 12,
    healthy: 10,
    degraded: 1,
    unhealthy: 1,
    unknown: 0,
  };

  beforeEach(() => {
    mockGetSystemHealth.mockResolvedValue(currentShape);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with the normalized system health summary', async () => {
    const req = makeRequest();
    const response = await (GET as Function)(req, CTX);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(currentShape);
    expect(mockGetSystemHealth).toHaveBeenCalledOnce();
  });

  it('normalizes the legacy `{total, down}` wire shape into `{totalServices, unhealthy}`', async () => {
    // Some Core deployments still return the legacy shape. The dashboard
    // component reads `data.totalServices` and `data.unhealthy` — if we pass
    // the legacy shape through, "Unhealthy" renders with no count.
    mockGetSystemHealth.mockResolvedValue({
      total: 12,
      healthy: 10,
      degraded: 1,
      down: 1,
      unknown: 0,
    });

    const req = makeRequest();
    const response = await (GET as Function)(req, CTX);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      totalServices: 12,
      healthy: 10,
      degraded: 1,
      unhealthy: 1,
      unknown: 0,
    });
  });

  it('coerces missing numeric fields to 0 so the UI never renders undefined counts', async () => {
    mockGetSystemHealth.mockResolvedValue({ totalServices: 3, healthy: 3 });

    const req = makeRequest();
    const response = await (GET as Function)(req, CTX);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      totalServices: 3,
      healthy: 3,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
    });
  });

  it('returns 502 when Core fails with a non-404 error (AC-042: logs + captures)', async () => {
    const boom = new Error('Core API unavailable');
    mockGetSystemHealth.mockRejectedValue(boom);

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
      path: '/api/topology/health',
      userId: 'user_test',
      tenantId: 'tenant_test',
      err: boom,
    });
    expect(typeof payload.duration).toBe('number');
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    expect(sentryMock.captureException.mock.calls[0][0]).toBe(boom);
    expect(sentryMock.captureException.mock.calls[0][1].extra).toMatchObject({
      method: 'GET',
      path: '/api/topology/health',
      userId: 'user_test',
      tenantId: 'tenant_test',
    });
  });

  it('returns 200 with an empty SystemHealthSummary when Core returns 404 (AC-042: no capture)', async () => {
    // Staging Core may not have /v1/topology/health deployed — handler degrades
    // gracefully so the dashboard section can render its empty state.
    mockGetSystemHealth.mockRejectedValue(new Error('Not Found'));

    const req = makeRequest();
    const response = await (GET as Function)(req, CTX);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      totalServices: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
    });

    // AC-042: graceful-degrade (not-found) branch is intentional — must NOT capture
    expect(dashLoggerMock.error).not.toHaveBeenCalled();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });
});

describe('topology-health-handler — auth contract', () => {
  it('withAuth is used to wrap the handler', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./topology-health-handler.ts', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('withAuth');
    expect(source).toContain('getSystemHealth');
  });
});
