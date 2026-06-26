/**
 * Tests for business-profile BFF handler (GET + POST).
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth:
    (handler: Function, _opts?: unknown) => async (req: NextRequest, _routeCtx: unknown) => {
      const ctx = {
        userId: 'user-test',
        tenantId: 'tenant-test',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin' as const,
        profileComplete: true,
      };
      return handler(req, ctx, {});
    },
}));

const mockApiClient = {
  seedMemoryContext: vi.fn().mockResolvedValue({ memoryId: 'mock-mem-1' }),
};
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => mockApiClient,
}));

vi.mock('@/contexts/onboarding/infrastructure/business-profile-schemas/registry', () => ({
  getActiveSchema: vi.fn(() => ({
    version: 'v1',
    title: 'Test',
    supportedLocales: ['en', 'pt-br'],
    defaultLocale: 'en',
    steps: [
      {
        id: 'company',
        title: 'Company',
        fields: [{ id: 'companyName', type: 'text', label: 'Company name', required: true }],
      },
    ],
  })),
}));

const { GET, POST } = await import('./business-profile-handler');

function makeRequest(body?: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/onboarding/business-profile', {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/onboarding/business-profile', () => {
  it('always returns null (no read endpoint on Core API memory)', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profile).toBeNull();
  });
});

describe('POST /api/onboarding/business-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.seedMemoryContext.mockResolvedValue({ memoryId: 'mock-mem-1' });
  });

  it('returns 200 with valid body', async () => {
    const res = await POST(
      makeRequest({ schemaVersion: 'v1', answers: { companyName: 'Acme' }, locale: 'en' }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profile).toBeDefined();
    expect(json.profile.locale).toBe('en');
  });

  it('calls seedMemoryContext exactly once per successful submit', async () => {
    await POST(
      makeRequest({ schemaVersion: 'v1', answers: { companyName: 'Acme' }, locale: 'en' }),
      { params: Promise.resolve({}) },
    );
    expect(mockApiClient.seedMemoryContext).toHaveBeenCalledTimes(1);
    expect(mockApiClient.seedMemoryContext).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'business-profile',
        schemaVersion: 'v1',
        markdown: expect.any(String),
      }),
    );
  });

  it('returns 200 with hindsightStatus=failed when Core API is unreachable', async () => {
    mockApiClient.seedMemoryContext.mockRejectedValueOnce(new Error('Core unreachable'));
    const res = await POST(
      makeRequest({ schemaVersion: 'v1', answers: { companyName: 'Acme' }, locale: 'en' }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profile.hindsightStatus).toBe('failed');
  });

  it('returns 400 when payload exceeds 20KB', async () => {
    const bigAnswers = { companyName: 'x'.repeat(25_000) };
    const res = await POST(makeRequest({ schemaVersion: 'v1', answers: bigAnswers }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/payload|too large|size/i);
  });

  it('returns 400 when locale is present but invalid', async () => {
    const res = await POST(makeRequest({ schemaVersion: 'v1', answers: {}, locale: 'fr' }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });

  it('falls back to schema defaultLocale when body omits locale', async () => {
    const res = await POST(makeRequest({ schemaVersion: 'v1', answers: { companyName: 'Acme' } }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profile.locale).toBe('en');
  });
});
