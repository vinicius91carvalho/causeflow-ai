/**
 * Tests for POST /api/onboarding/business-profile/skip
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

const { POST } = await import('./business-profile-skip-handler');

describe('POST /api/onboarding/business-profile/skip', () => {
  it('returns 200 with skippedAt timestamp', async () => {
    const req = new NextRequest('http://localhost/api/onboarding/business-profile/skip', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skippedAt).toBeTruthy();
    expect(new Date(json.skippedAt).getTime()).toBeGreaterThan(0);
  });
});
