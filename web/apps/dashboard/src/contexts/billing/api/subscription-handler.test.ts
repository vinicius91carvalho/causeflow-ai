import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, { tenantId: 't1', role: 'member' }),
}));

const mockGetSubscription = vi.fn();

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({ getSubscription: mockGetSubscription }),
}));

import { GET } from './subscription-handler';

describe('GET /api/billing/subscription', () => {
  beforeEach(async () => {
    mockGetSubscription.mockReset();
    const { _resetCreditsLedgerForTests } = await import(
      '@/contexts/billing/application/credits-ledger'
    );
    _resetCreditsLedgerForTests();
  });

  it('returns hasStripeCustomer=true when Subscription includes a currentPeriodEnd', async () => {
    // `hasStripeCustomer` is now derived from `currentPeriodEnd` (not
    // `stripeCustomerId`) because the Core API's GetSubscriptionUseCase
    // does not expose `stripeCustomerId` in its response. `currentPeriodEnd`
    // is only populated by Stripe webhooks, so it's the most reliable
    // "this tenant completed real checkout" marker available here.
    mockGetSubscription.mockResolvedValueOnce({
      plan: 'starter',
      status: 'active',
      investigationsLimit: 15,
      investigationsUsed: 2,
      currentPeriodEnd: '2026-05-08T00:00:00.000Z',
    });

    const res = await (GET as any)(new NextRequest('http://localhost/api/billing/subscription'));
    const body = await res.json();

    expect(body.plan).toBe('starter');
    expect(body.subscriptionStatus).toBe('active');
    expect(body.creditsTotal).toBe(15);
    expect(body.creditsUsed).toBe(2);
    expect(body.creditsRemaining).toBe(13);
    expect(body.hasStripeCustomer).toBe(true);
    expect(body.currentPeriodEnd).toBe('2026-05-08T00:00:00.000Z');
  });

  it('returns hasStripeCustomer=false when Subscription has no currentPeriodEnd (fresh-tenant default)', async () => {
    // This is the vinicius@causeflow.ai case: Core API defaults status to "active"
    // for tenants that never touched Stripe. Without cross-checking the
    // subscription's currentPeriodEnd, we'd incorrectly treat this as a paid plan.
    mockGetSubscription.mockResolvedValueOnce({
      plan: 'starter',
      status: 'active',
      currentPeriodEnd: null,
    });

    const res = await (GET as any)(new NextRequest('http://localhost/api/billing/subscription'));
    const body = await res.json();

    expect(body.subscriptionStatus).toBe('active');
    expect(body.hasStripeCustomer).toBe(false);
  });

  it('handles a null Subscription gracefully', async () => {
    mockGetSubscription.mockResolvedValueOnce(null);

    const res = await (GET as any)(new NextRequest('http://localhost/api/billing/subscription'));
    const body = await res.json();

    expect(body.plan).toBe('free');
    expect(body.subscriptionStatus).toBe('active');
    expect(body.creditsTotal).toBe(3);
    expect(body.creditsRemaining).toBe(3);
    expect(body.hasStripeCustomer).toBe(false);
  });
});
