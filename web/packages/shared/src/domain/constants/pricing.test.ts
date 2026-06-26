import { describe, expect, it } from 'vitest';
import { PRICING_PLANS } from './pricing';

describe('PRICING_PLANS', () => {
  it('has 4 plans (no free plan)', () => {
    expect(PRICING_PLANS).toHaveLength(4);
  });

  it('does not include a free plan', () => {
    const ids = PRICING_PLANS.map((p) => p.id);
    expect(ids).not.toContain('free');
  });

  it('starter plan costs $99 with 15 investigations and $8.99 overage', () => {
    const starter = PRICING_PLANS.find((p) => p.id === 'starter');
    expect(starter?.price).toBe(99);
    expect(starter?.investigations).toBe('15/month');
    expect(starter?.overage).toBe('$8.99/each');
  });

  it('pro plan costs $349 with 60 investigations and $8.99 overage', () => {
    const pro = PRICING_PLANS.find((p) => p.id === 'pro');
    expect(pro?.price).toBe(349);
    expect(pro?.investigations).toBe('60/month');
    expect(pro?.overage).toBe('$8.99/each');
  });

  it('business plan costs $899 with 200 investigations and $8.99 overage', () => {
    const business = PRICING_PLANS.find((p) => p.id === 'business');
    expect(business?.price).toBe(899);
    expect(business?.investigations).toBe('200/month');
    expect(business?.overage).toBe('$8.99/each');
  });

  it('enterprise plan has custom pricing', () => {
    const enterprise = PRICING_PLANS.find((p) => p.id === 'enterprise');
    expect(enterprise?.price).toBe('Custom');
  });

  it('pro plan is highlighted (most popular)', () => {
    const pro = PRICING_PLANS.find((p) => p.id === 'pro');
    expect(pro?.highlighted).toBe(true);
  });
});
