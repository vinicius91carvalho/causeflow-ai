import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, { tenantId: 't1', role: 'admin', email: 'a@b.com', userId: 'u1' }),
}));

const mockGetSubscription = vi.fn();

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({ getSubscription: mockGetSubscription }),
}));

import { GET } from './checkout-complete-handler';

describe('GET /api/billing/checkout/complete', () => {
  beforeEach(() => {
    mockGetSubscription.mockReset();
  });

  it('redirects to /onboarding/integrations when subscription is active with currentPeriodEnd set (onboarding flow)', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      status: 'active',
      currentPeriodEnd: '2026-05-08T00:00:00.000Z',
    });

    // biome-ignore lint/suspicious/noExplicitAny: test helper — withAuth mock accepts 1 arg
    const res = await (GET as any)(
      new NextRequest('http://localhost/api/billing/checkout/complete'),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/onboarding/integrations');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('redirects to /dashboard/billing?success=1 when from=billing', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      status: 'active',
      currentPeriodEnd: '2026-05-08T00:00:00.000Z',
    });

    // biome-ignore lint/suspicious/noExplicitAny: test helper — withAuth mock accepts 1 arg
    const res = await (GET as any)(
      new NextRequest('http://localhost/api/billing/checkout/complete?from=billing&plan=pro'),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard/billing?success=1');
    expect(res.headers.get('location')).toContain('plan=pro');
  });

  it('redirects to choose-plan with payment_failed=1 when subscription is not active', async () => {
    // All 5 poll attempts return a non-active status.
    mockGetSubscription.mockResolvedValue({
      status: 'past_due',
      stripeCustomerId: 'cus_test_123',
    });

    // biome-ignore lint/suspicious/noExplicitAny: test helper — withAuth mock accepts 1 arg
    const res = await (GET as any)(
      new NextRequest('http://localhost/api/billing/checkout/complete'),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/onboarding/choose-plan?payment_failed=1');
  });

  it('redirects to choose-plan when Core API reports active but currentPeriodEnd missing (fresh-tenant default)', async () => {
    mockGetSubscription.mockResolvedValue({ status: 'active', currentPeriodEnd: null });

    // biome-ignore lint/suspicious/noExplicitAny: test helper — withAuth mock accepts 1 arg
    const res = await (GET as any)(
      new NextRequest('http://localhost/api/billing/checkout/complete'),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/onboarding/choose-plan');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('retries and succeeds if the first poll sees a stale subscription', async () => {
    // First 2 polls: stale (not yet propagated). Third poll: active.
    mockGetSubscription
      .mockResolvedValueOnce({ status: 'incomplete', currentPeriodEnd: null })
      .mockResolvedValueOnce({ status: 'incomplete', currentPeriodEnd: null })
      .mockResolvedValueOnce({ status: 'active', currentPeriodEnd: '2026-05-08T00:00:00.000Z' });

    // biome-ignore lint/suspicious/noExplicitAny: test helper — withAuth mock accepts 1 arg
    const res = await (GET as any)(
      new NextRequest('http://localhost/api/billing/checkout/complete'),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/onboarding/integrations');
    expect(mockGetSubscription).toHaveBeenCalledTimes(3);
  });

  it('treats transient errors as "not yet active" and retries', async () => {
    mockGetSubscription
      .mockRejectedValueOnce(new Error('Transient network error'))
      .mockResolvedValueOnce({ status: 'active', currentPeriodEnd: '2026-05-08T00:00:00.000Z' });

    // biome-ignore lint/suspicious/noExplicitAny: test helper — withAuth mock accepts 1 arg
    const res = await (GET as any)(
      new NextRequest('http://localhost/api/billing/checkout/complete'),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/onboarding/integrations');
  });
});
