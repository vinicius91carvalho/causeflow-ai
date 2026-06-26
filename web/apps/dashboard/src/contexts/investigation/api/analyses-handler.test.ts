/**
 * Tests for analyses-handler — error mapping from Core API → BFF status codes.
 *
 * Sprint goal: ensure that when the upstream Core API rejects a request with
 * FORBIDDEN, NOT_FOUND, RATE_LIMIT, etc., the BFF surfaces the corresponding
 * HTTP status (403, 404, 429) instead of always returning 500. The dashboard
 * UI relies on these codes to render the right error message.
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreApiError } from '@/lib/api/http-api-client';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const createIncident = vi.fn();
const listIncidents = vi.fn();

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    createIncident,
    listIncidents,
  }),
}));

vi.mock('@/lib/api/with-auth', () => ({
  withAuth:
    (fn: (req: NextRequest, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: NextRequest, _routeCtx: { params: Promise<Record<string, string>> }) =>
      fn(req, {
        userId: 'user_test',
        tenantId: 'tenant_test',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        profileComplete: true,
      }),
}));

beforeEach(() => {
  createIncident.mockReset();
  listIncidents.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function importHandler() {
  return await import('./analyses-handler');
}

function postRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3001/api/analyses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getRequest(): NextRequest {
  return new NextRequest('http://localhost:3001/api/analyses');
}

// Next.js 15 RouteContext shape — non-dynamic routes still receive a resolved Promise
const ROUTE_CTX = { params: Promise.resolve({}) };

const VALID_BODY = {
  title: 'Test incident with enough characters',
  description: 'A reproducible failure scenario for the regression test suite.',
  severity: 'high' as const,
};

// ─── POST /api/analyses error mapping ─────────────────────────────────────────

describe('POST /api/analyses — Core API error mapping', () => {
  it('returns 403 when Core throws CoreApiError(403, "FORBIDDEN")', async () => {
    createIncident.mockRejectedValueOnce(new CoreApiError('FORBIDDEN', 403));
    const { POST } = await importHandler();
    const res = await POST(postRequest(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('FORBIDDEN');
  });

  it('returns 404 when Core throws CoreApiError(404, "NOT_FOUND")', async () => {
    createIncident.mockRejectedValueOnce(new CoreApiError('NOT_FOUND', 404));
    const { POST } = await importHandler();
    const res = await POST(postRequest(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(404);
  });

  it('returns 429 when Core throws CoreApiError(429, "RATE_LIMIT")', async () => {
    createIncident.mockRejectedValueOnce(new CoreApiError('RATE_LIMIT', 429));
    const { POST } = await importHandler();
    const res = await POST(postRequest(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(429);
  });

  it('falls back to 403 when error is a plain Error("FORBIDDEN")', async () => {
    createIncident.mockRejectedValueOnce(new Error('FORBIDDEN'));
    const { POST } = await importHandler();
    const res = await POST(postRequest(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(403);
  });

  it('falls back to 404 when error is a plain Error("NOT_FOUND")', async () => {
    createIncident.mockRejectedValueOnce(new Error('NOT_FOUND'));
    const { POST } = await importHandler();
    const res = await POST(postRequest(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(404);
  });

  it('falls back to 500 for unmapped errors', async () => {
    createIncident.mockRejectedValueOnce(new Error('Database connection lost'));
    const { POST } = await importHandler();
    const res = await POST(postRequest(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(500);
  });

  it('returns 201 with the created incident on success', async () => {
    createIncident.mockResolvedValueOnce({ incidentId: 'inc_123', status: 'queued' });
    const { POST } = await importHandler();
    const res = await POST(postRequest(VALID_BODY), ROUTE_CTX);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { incidentId: string };
    expect(body.incidentId).toBe('inc_123');
  });

  it('returns 400 when body validation fails (title too short)', async () => {
    const { POST } = await importHandler();
    const res = await POST(
      postRequest({ title: 'ab', description: VALID_BODY.description }),
      ROUTE_CTX,
    );
    expect(res.status).toBe(400);
    expect(createIncident).not.toHaveBeenCalled();
  });
});

// ─── GET /api/analyses error mapping ──────────────────────────────────────────

describe('GET /api/analyses — Core API error mapping', () => {
  it('returns 403 when Core throws CoreApiError(403)', async () => {
    listIncidents.mockRejectedValueOnce(new CoreApiError('FORBIDDEN', 403));
    const { GET } = await importHandler();
    const res = await GET(getRequest(), ROUTE_CTX);
    expect(res.status).toBe(403);
  });

  it('returns 200 with the list on success', async () => {
    listIncidents.mockResolvedValueOnce({ items: [], cursor: null });
    const { GET } = await importHandler();
    const res = await GET(getRequest(), ROUTE_CTX);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { incidents: unknown[] };
    expect(body.incidents).toEqual([]);
  });
});
