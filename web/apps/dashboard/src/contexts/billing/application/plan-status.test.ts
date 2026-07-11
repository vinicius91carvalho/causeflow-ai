import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSubscription = vi.fn();

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({ getSubscription: mockGetSubscription }),
}));

import { fetchPlanStatus } from './plan-status';

describe('fetchPlanStatus', () => {
  const originalRuntime = process.env.CAUSEFLOW_RUNTIME;
  const originalStripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  beforeEach(() => {
    mockGetSubscription.mockReset();
    process.env.CAUSEFLOW_RUNTIME = 'commercial';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_commercial';
  });

  afterEach(() => {
    if (originalRuntime === undefined) delete process.env.CAUSEFLOW_RUNTIME;
    else process.env.CAUSEFLOW_RUNTIME = originalRuntime;
    if (originalStripeKey === undefined) delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalStripeKey;
  });

  it('returns hasActivePlan=true when status is active AND currentPeriodEnd is set', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      status: 'active',
      plan: 'starter',
      currentPeriodEnd: '2026-05-08T00:00:00.000Z',
    });
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(true);
    expect(result.hasStripeSubscription).toBe(true);
    expect(result.plan).toBe('starter');
    expect(result.status).toBe('active');
  });

  it('returns hasActivePlan=true for trialing with currentPeriodEnd', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      status: 'trialing',
      plan: 'pro',
      currentPeriodEnd: '2026-04-15T00:00:00.000Z',
    });
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(true);
  });

  it('returns hasActivePlan=false when Core API defaults status=active but currentPeriodEnd missing (fresh tenant)', async () => {
    // Commercial bug guard (AC-023): Core defaults status to "active" for
    // fresh tenants that never touched Stripe. Without currentPeriodEnd we
    // must not treat them as paid.
    mockGetSubscription.mockResolvedValueOnce({
      status: 'active',
      plan: 'starter',
      currentPeriodEnd: null,
    });
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(false);
    expect(result.hasStripeSubscription).toBe(false);
  });

  it('returns hasActivePlan=true for OSS free+active stub without currentPeriodEnd (AC-048)', async () => {
    process.env.CAUSEFLOW_RUNTIME = 'oss';
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    mockGetSubscription.mockResolvedValueOnce({
      status: 'active',
      plan: 'free',
      currentPeriodEnd: null,
    });
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(true);
    expect(result.hasStripeSubscription).toBe(false);
    expect(result.plan).toBe('free');
  });

  it('returns hasActivePlan=false when currentPeriodEnd is undefined', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      status: 'active',
      plan: 'starter',
    });
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(false);
  });

  it('returns hasActivePlan=false when status is past_due even with a currentPeriodEnd', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      status: 'past_due',
      currentPeriodEnd: '2026-05-08T00:00:00.000Z',
    });
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(false);
  });

  it('returns hasActivePlan=false when status is canceled', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      status: 'canceled',
      currentPeriodEnd: '2026-05-08T00:00:00.000Z',
    });
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(false);
  });

  it('returns hasActivePlan=false when Core API throws (commercial)', async () => {
    mockGetSubscription.mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.status).toBeNull();
  });

  it('returns hasActivePlan=true when Core API throws in OSS runtime (AC-048)', async () => {
    process.env.CAUSEFLOW_RUNTIME = 'oss';
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    mockGetSubscription.mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(true);
    expect(result.plan).toBe('free');
  });

  it('returns hasActivePlan=false when Core API returns null', async () => {
    mockGetSubscription.mockResolvedValueOnce(null);
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(false);
  });
});
