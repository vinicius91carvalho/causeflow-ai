import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  auth: () =>
    Promise.resolve({
      userId: 'user_1',
      orgId: 'org_1',
    }),
  clerkClient: () =>
    Promise.resolve({
      users: {
        getUser: () =>
          Promise.resolve({
            emailAddresses: [{ emailAddress: 'test@example.com' }],
          }),
      },
      organizations: {
        getOrganization: () => Promise.resolve({ name: 'Test Company' }),
      },
    }),
}));

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    createTenant: vi.fn().mockResolvedValue({ tenantId: 'tenant_1' }),
  }),
}));

vi.mock('@causeflow/shared/domain/utils/slug', () => ({
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
  randomSlugSuffix: () => 'abc',
}));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => '127.0.0.1',
  rateLimit: () => ({ success: true }),
}));

import { POST } from './complete-profile-handler';

describe('POST /api/onboarding/complete-profile', () => {
  it('creates tenant with empty body (teamSize is optional)', async () => {
    const req = new NextRequest('http://localhost/api/onboarding/complete-profile', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    // biome-ignore lint/suspicious/noExplicitAny: route called without RouteContext in tests
    const res = await (POST as any)(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tenantId).toBe('tenant_1');
  });

  it('creates tenant with full profile data', async () => {
    const req = new NextRequest('http://localhost/api/onboarding/complete-profile', {
      method: 'POST',
      body: JSON.stringify({ teamSize: '1_5', fullName: 'Alice', role: 'CTO' }),
      headers: { 'Content-Type': 'application/json' },
    });

    // biome-ignore lint/suspicious/noExplicitAny: route called without RouteContext in tests
    const res = await (POST as any)(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
