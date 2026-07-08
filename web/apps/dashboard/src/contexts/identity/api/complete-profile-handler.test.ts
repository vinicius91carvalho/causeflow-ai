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

const createTenantMock = vi.fn().mockResolvedValue({ tenantId: 'tenant_1' });
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    createTenant: (...args: unknown[]) => createTenantMock(...args),
  }),
}));

vi.mock('@/lib/api/http-api-client', () => ({
  CoreApiError: class CoreApiError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'CoreApiError';
      this.status = status;
    }
  },
}));

const provisionTenantDirectMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/contexts/identity/infrastructure/tenant-provisioning-fallback', () => ({
  provisionTenantDirect: (...args: unknown[]) => provisionTenantDirectMock(...args),
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

  it('falls back to direct DynamoDB provisioning when Core returns 403', async () => {
    provisionTenantDirectMock.mockClear();
    const { CoreApiError } = await import('@/lib/api/http-api-client');
    createTenantMock.mockRejectedValueOnce(
      new CoreApiError('Insufficient permissions. Required: admin | owner', 403),
    );

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
    // The Clerk org_id becomes the tenantId when the fallback runs.
    expect(body.tenantId).toBe('org_1');
    expect(provisionTenantDirectMock).toHaveBeenCalledTimes(1);
    expect(provisionTenantDirectMock).toHaveBeenCalledWith({
      tenantId: 'org_1',
      name: 'Test Company',
      slug: 'test-company',
      ownerEmail: 'test@example.com',
    });
  });
});
