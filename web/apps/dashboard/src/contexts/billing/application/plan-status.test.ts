import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSubscription = vi.fn();

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({ getSubscription: mockGetSubscription }),
}));

import { fetchPlanStatus } from './plan-status';

describe('fetchPlanStatus', () => {
  beforeEach(() => {
    mockGetSubscription.mockReset();
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
    // This is the exact bug that let vinicius@causeflow.ai into /dashboard.
    // Core API reports status: "active" as a DEFAULT for fresh tenants that
    // never touched Stripe. Without cross-checking currentPeriodEnd we'd
    // incorrectly treat them as paid users. currentPeriodEnd is only set by
    // the Stripe webhook flow, so its presence proves a real subscription.
    mockGetSubscription.mockResolvedValueOnce({
      status: 'active',
      plan: 'starter',
      currentPeriodEnd: null,
    });
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(false);
    expect(result.hasStripeSubscription).toBe(false);
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

  it('returns hasActivePlan=false when Core API throws', async () => {
    mockGetSubscription.mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.status).toBeNull();
  });

  it('returns hasActivePlan=false when Core API returns null', async () => {
    mockGetSubscription.mockResolvedValueOnce(null);
    const result = await fetchPlanStatus();
    expect(result.hasActivePlan).toBe(false);
  });
});
