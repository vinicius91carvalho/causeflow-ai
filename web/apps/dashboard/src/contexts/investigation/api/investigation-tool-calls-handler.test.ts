/**
 * AC-042: when the tool-calls handler catches a non-recoverable (5xx) error,
 * it must (a) call dashLogger.error with {method,path,userId,tenantId,duration},
 * (b) forward the error to Sentry.captureException. 4xx errors must NOT capture.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock withAuth to pass-through (handler receives (req, ctx, params))
vi.mock('@/lib/api/with-auth', () => ({
  withAuth:
    (handler: (req: NextRequest, ctx: unknown, params?: unknown) => Promise<unknown>) =>
    async (req: NextRequest, routeCtx?: { params?: Promise<unknown> }) => {
      const params = routeCtx?.params ? await routeCtx.params : undefined;
      return handler(req, { userId: 'user_test', tenantId: 'tenant_test' }, params);
    },
}));

const dashLoggerMock = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
vi.mock('@/lib/logger', () => ({ logger: dashLoggerMock }));

const sentryMock = { captureException: vi.fn() };
vi.mock('@sentry/nextjs', () => ({ default: sentryMock, ...sentryMock }));

const mockGetToolCall = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({ getToolCall: mockGetToolCall }),
}));

const { GET } = await import('./investigation-tool-calls-handler');

const ROUTE_CTX = { params: Promise.resolve({ id: 'inc_1', toolCallId: 'tc_1' }) };

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3001/api/investigation/inc_1/tool-calls/tc_1', {
    method: 'GET',
  });
}

describe('GET /api/investigation/[id]/tool-calls/[toolCallId] — AC-042', () => {
  beforeEach(() => {
    mockGetToolCall.mockReset();
    dashLoggerMock.error.mockClear();
    sentryMock.captureException.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with the tool call record on success', async () => {
    mockGetToolCall.mockResolvedValueOnce({ id: 'tc_1', input: {}, output: {} });
    const res = await GET(makeRequest(), ROUTE_CTX);
    expect(res.status).toBe(200);
    expect(dashLoggerMock.error).not.toHaveBeenCalled();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it('returns 500 and logs + captures when Core throws a plain error', async () => {
    const boom = new Error('Core database lost');
    mockGetToolCall.mockRejectedValueOnce(boom);
    const res = await GET(makeRequest(), ROUTE_CTX);
    expect(res.status).toBe(500);

    expect(dashLoggerMock.error).toHaveBeenCalledTimes(1);
    const payload = dashLoggerMock.error.mock.calls[0][0];
    expect(payload).toMatchObject({
      method: 'GET',
      path: '/api/investigation/inc_1/tool-calls/tc_1',
      userId: 'user_test',
      tenantId: 'tenant_test',
      err: boom,
    });
    expect(typeof payload.duration).toBe('number');
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    expect(sentryMock.captureException.mock.calls[0][0]).toBe(boom);
    expect(sentryMock.captureException.mock.calls[0][1].extra).toMatchObject({
      method: 'GET',
      path: '/api/investigation/inc_1/tool-calls/tc_1',
      userId: 'user_test',
      tenantId: 'tenant_test',
    });
  });

  it('does NOT capture on 4xx errors (AC-042: recoverable client errors)', async () => {
    const notFound = Object.assign(new Error('NOT_FOUND'), { status: 404 });
    mockGetToolCall.mockRejectedValueOnce(notFound);
    const res = await GET(makeRequest(), ROUTE_CTX);
    expect(res.status).toBe(404);
    expect(dashLoggerMock.error).not.toHaveBeenCalled();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it('captures on 5xx errors that carry a status field', async () => {
    const serverError = Object.assign(new Error('boom'), { status: 503 });
    mockGetToolCall.mockRejectedValueOnce(serverError);
    const res = await GET(makeRequest(), ROUTE_CTX);
    expect(res.status).toBe(503);
    expect(dashLoggerMock.error).toHaveBeenCalledTimes(1);
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
  });
});
