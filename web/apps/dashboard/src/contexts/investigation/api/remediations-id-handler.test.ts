import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal route handler shape for test-only casts.
type RouteHandler = (
  req: unknown,
  ctx?: unknown,
) => Promise<Response & { json: () => Promise<Record<string, unknown>> }>;

// Mock withAuth — real withAuth awaits routeContext.params then invokes the
// inner handler with (req, authCtx, params). The mock mirrors that so params
// actually reaches the handler in tests.
vi.mock('@/lib/api/with-auth', () => ({
  withAuth:
    (handler: (req: unknown, ctx: unknown, params?: Record<string, string>) => Promise<Response>) =>
    async (req: unknown, routeContext?: { params?: Promise<Record<string, string>> }) => {
      const authCtx = {
        userId: 'test-user',
        tenantId: 'test-tenant',
        email: 'test@causeflow.ai',
        name: 'Test User',
        role: 'admin' as const,
        profileComplete: true,
      };
      const params = routeContext?.params ? await routeContext.params : undefined;
      return handler(req, authCtx, params);
    },
}));

// Mock getApiClient with the three action methods plus get.
const mockGetRemediation = vi.fn();
const mockApprove = vi.fn();
const mockReject = vi.fn();
const mockExecute = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    getRemediation: mockGetRemediation,
    approveRemediation: mockApprove,
    rejectRemediation: mockReject,
    executeRemediation: mockExecute,
  }),
}));

// Must import AFTER mocks
const { GET, POST } = await import('./remediations-id-handler');

const fixtureRemediation = {
  remediationId: 'rem-1',
  incidentId: 'inc-1',
  status: 'proposed' as const,
  description: 'Restart the service',
  rootCause: 'memory leak',
};

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('remediations-id-handler — POST action routing', () => {
  beforeEach(() => {
    mockApprove.mockResolvedValue({ ...fixtureRemediation, status: 'approved' });
    mockReject.mockResolvedValue({ ...fixtureRemediation, status: 'rejected' });
    mockExecute.mockResolvedValue({ ...fixtureRemediation, status: 'executing' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('approve action calls approveRemediation and returns 200', async () => {
    const req = jsonRequest('http://localhost:3001/api/remediations/rem-1', 'POST', {
      action: 'approve',
    });
    const ctx = { params: Promise.resolve({ id: 'rem-1' }) };
    const response = await (POST as unknown as RouteHandler)(req, ctx);

    expect(response.status).toBe(200);
    expect(mockApprove).toHaveBeenCalledWith('rem-1');
    const data = await response.json();
    expect((data.remediation as { status: string }).status).toBe('approved');
  });

  it('reject action forwards reason to rejectRemediation', async () => {
    const req = jsonRequest('http://localhost:3001/api/remediations/rem-1', 'POST', {
      action: 'reject',
      reason: 'not safe',
    });
    const ctx = { params: Promise.resolve({ id: 'rem-1' }) };
    const response = await (POST as unknown as RouteHandler)(req, ctx);

    expect(response.status).toBe(200);
    expect(mockReject).toHaveBeenCalledWith('rem-1', 'not safe');
  });

  it('execute action calls executeRemediation', async () => {
    const req = jsonRequest('http://localhost:3001/api/remediations/rem-1', 'POST', {
      action: 'execute',
    });
    const ctx = { params: Promise.resolve({ id: 'rem-1' }) };
    const response = await (POST as unknown as RouteHandler)(req, ctx);

    expect(response.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledWith('rem-1');
  });

  it('returns 404 when upstream reports not found', async () => {
    mockApprove.mockRejectedValue(new Error('404 not found'));
    const req = jsonRequest('http://localhost:3001/api/remediations/rem-1', 'POST', {
      action: 'approve',
    });
    const ctx = { params: Promise.resolve({ id: 'rem-1' }) };
    const response = await (POST as unknown as RouteHandler)(req, ctx);

    expect(response.status).toBe(404);
  });

  it('returns 409 when upstream reports conflict', async () => {
    mockApprove.mockRejectedValue(new Error('409 conflict'));
    const req = jsonRequest('http://localhost:3001/api/remediations/rem-1', 'POST', {
      action: 'approve',
    });
    const ctx = { params: Promise.resolve({ id: 'rem-1' }) };
    const response = await (POST as unknown as RouteHandler)(req, ctx);

    expect(response.status).toBe(409);
  });

  it('returns 500 when upstream fails with a generic error', async () => {
    mockApprove.mockRejectedValue(new Error('boom'));
    const req = jsonRequest('http://localhost:3001/api/remediations/rem-1', 'POST', {
      action: 'approve',
    });
    const ctx = { params: Promise.resolve({ id: 'rem-1' }) };
    const response = await (POST as unknown as RouteHandler)(req, ctx);

    expect(response.status).toBe(500);
  });
});

describe('remediations-id-handler — GET', () => {
  beforeEach(() => {
    mockGetRemediation.mockResolvedValue(fixtureRemediation);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with the remediation', async () => {
    const req = new Request('http://localhost:3001/api/remediations/rem-1', { method: 'GET' });
    const ctx = { params: Promise.resolve({ id: 'rem-1' }) };
    const response = await (GET as unknown as RouteHandler)(req, ctx);

    expect(response.status).toBe(200);
    expect(mockGetRemediation).toHaveBeenCalledWith('rem-1');
  });

  it('returns 404 when the remediation is missing', async () => {
    mockGetRemediation.mockRejectedValue(new Error('404 not found'));
    const req = new Request('http://localhost:3001/api/remediations/rem-1', { method: 'GET' });
    const ctx = { params: Promise.resolve({ id: 'rem-1' }) };
    const response = await (GET as unknown as RouteHandler)(req, ctx);

    expect(response.status).toBe(404);
  });
});
