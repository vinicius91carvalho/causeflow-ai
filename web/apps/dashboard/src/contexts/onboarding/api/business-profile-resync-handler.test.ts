/**
 * Tests for POST /api/onboarding/business-profile/resync
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

const { POST } = await import('./business-profile-resync-handler');

describe('POST /api/onboarding/business-profile/resync', () => {
  it('returns 404 — resync requires re-submission via the form', async () => {
    const req = new NextRequest('http://localhost/api/onboarding/business-profile/resync', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/resync|re-submit/i);
  });
});
