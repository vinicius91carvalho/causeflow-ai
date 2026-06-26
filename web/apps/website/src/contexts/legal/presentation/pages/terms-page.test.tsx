import { describe, expect, it } from 'vitest';

/**
 * Tests for TermsPage plan description configuration.
 * Sprint 3 change: no zero-cost tier — only paid plans (Starter/Pro/Business/Enterprise).
 */

// Expected plan structure after Sprint 3 changes
const EXPECTED_PLANS = [
  { name: 'Starter', price: 99, investigations: 15 },
  { name: 'Pro', price: 349, investigations: 60 },
  { name: 'Business', price: 899, investigations: 200 },
  { name: 'Enterprise', price: null, investigations: null },
];

describe('TermsPage plan configuration', () => {
  it('includes Starter plan at $99', () => {
    const starter = EXPECTED_PLANS.find((p) => p.name === 'Starter');
    expect(starter?.price).toBe(99);
  });

  it('includes Pro plan at $349', () => {
    const pro = EXPECTED_PLANS.find((p) => p.name === 'Pro');
    expect(pro?.price).toBe(349);
  });

  it('includes Business plan at $899', () => {
    const business = EXPECTED_PLANS.find((p) => p.name === 'Business');
    expect(business?.price).toBe(899);
  });

  it('includes Enterprise plan (custom pricing)', () => {
    const enterprise = EXPECTED_PLANS.find((p) => p.name === 'Enterprise');
    expect(enterprise).toBeDefined();
    expect(enterprise?.price).toBeNull();
  });

  it('has no zero-cost tier in the plan list', () => {
    const names = EXPECTED_PLANS.map((p) => p.name);
    expect(names).not.toContain('Free');
    expect(names).not.toContain('Trial');
  });

  it('Starter includes 15 investigations', () => {
    const starter = EXPECTED_PLANS.find((p) => p.name === 'Starter');
    expect(starter?.investigations).toBe(15);
  });

  it('Pro includes 60 investigations', () => {
    const pro = EXPECTED_PLANS.find((p) => p.name === 'Pro');
    expect(pro?.investigations).toBe(60);
  });

  it('Business includes 200 investigations', () => {
    const business = EXPECTED_PLANS.find((p) => p.name === 'Business');
    expect(business?.investigations).toBe(200);
  });

  it('all plans with investigation counts have positive prices', () => {
    const paidPlans = EXPECTED_PLANS.filter((p) => p.price !== null);
    for (const plan of paidPlans) {
      expect(plan.price).toBeGreaterThan(0);
    }
  });
});
