import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsOssRuntime = vi.fn(() => false);

vi.mock('@/contexts/billing/application/oss-runtime', () => ({
  isOssRuntime: () => mockIsOssRuntime(),
}));

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, { tenantId: 't1', role: 'admin', email: 'a@b.com', userId: 'u1' }),
}));

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    createSubscription: vi.fn().mockResolvedValue({
      subscriptionId: 'sub_test',
      clientSecret: 'pi_secret',
      status: 'incomplete',
    }),
  }),
}));

import { POST } from './subscribe-handler';

describe('POST /api/billing/subscribe', () => {
  beforeEach(() => {
    mockIsOssRuntime.mockReturnValue(false);
  });

  it('returns 404 in OSS runtime without calling Core (AC-012)', async () => {
    mockIsOssRuntime.mockReturnValue(true);
    const req = new NextRequest('http://localhost/api/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ planId: 'starter' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(404);
  });

  it('returns subscriptionId and clientSecret from Core API', async () => {
    const req = new NextRequest('http://localhost/api/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ planId: 'starter' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscriptionId).toBe('sub_test');
    expect(body.clientSecret).toBe('pi_secret');
  });

  it('returns 400 for an invalid planId', async () => {
    const req = new NextRequest('http://localhost/api/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ planId: 'enterprise' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(400);
  });
});
