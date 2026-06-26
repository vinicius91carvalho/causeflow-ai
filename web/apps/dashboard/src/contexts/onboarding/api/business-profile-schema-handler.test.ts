/**
 * Tests for GET /api/onboarding/business-profile/schema
 */
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('@/contexts/onboarding/infrastructure/business-profile-schemas/registry', () => ({
  getActiveSchema: vi.fn(() => ({
    version: 'v1',
    title: 'Tell us about your business',
    supportedLocales: ['en', 'pt-br'],
    defaultLocale: 'en',
    steps: [],
  })),
}));

const { GET } = await import('./business-profile-schema-handler');

describe('GET /api/onboarding/business-profile/schema', () => {
  it('returns 200 with the schema', async () => {
    const req = new NextRequest('http://localhost/api/onboarding/business-profile/schema');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.schema).toBeDefined();
    expect(json.schema.version).toBe('v1');
    expect(json.schema.supportedLocales).toContain('en');
  });
});
