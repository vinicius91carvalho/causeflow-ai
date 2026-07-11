import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCreditsForPlan, getPlanByStripePriceId, getSelfServicePlans, PLANS } from '../plans';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('PLANS', () => {
  it('has exactly 4 entries', () => {
    expect(Object.keys(PLANS)).toHaveLength(4);
  });

  it('every plan has required fields', () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('price');
      expect(plan).toHaveProperty('credits');
      expect(plan).toHaveProperty('overagePerCredit');
      expect(plan).toHaveProperty('selfService');
      expect(plan).toHaveProperty('stripePriceEnvVar');
      expect(plan).toHaveProperty('features');
    }
  });

  it('all plans have non-empty features array', () => {
    for (const plan of Object.values(PLANS)) {
      expect(Array.isArray(plan.features)).toBe(true);
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it('all plans have non-empty name string', () => {
    for (const plan of Object.values(PLANS)) {
      expect(typeof plan.name).toBe('string');
      expect(plan.name.length).toBeGreaterThan(0);
    }
  });

  describe('starter plan', () => {
    it('has correct values', () => {
      const plan = PLANS.starter;
      expect(plan.price).toBe(99);
      expect(plan.credits).toBe(15);
      expect(plan.selfService).toBe(true);
      expect(plan.stripePriceEnvVar).toBe('STRIPE_PRICE_STARTER');
      expect(plan.id).toBe('starter');
    });
  });

  describe('pro plan', () => {
    it('has correct values', () => {
      const plan = PLANS.pro;
      expect(plan.price).toBe(349);
      expect(plan.credits).toBe(60);
      expect(plan.selfService).toBe(true);
      expect(plan.id).toBe('pro');
    });
  });

  describe('business plan', () => {
    it('has correct values', () => {
      const plan = PLANS.business;
      expect(plan.price).toBe(899);
      expect(plan.credits).toBe(200);
      expect(plan.selfService).toBe(true);
      expect(plan.stripePriceEnvVar).toBe('STRIPE_PRICE_BUSINESS');
      expect(plan.id).toBe('business');
    });
  });

  describe('enterprise plan', () => {
    it('has correct values', () => {
      const plan = PLANS.enterprise;
      expect(plan.price).toBe(-1);
      expect(plan.credits).toBe(-1);
      expect(plan.selfService).toBe(false);
      expect(plan.stripePriceEnvVar).toBeNull();
      expect(plan.id).toBe('enterprise');
    });
  });
});

describe('getPlanByStripePriceId', () => {
  it('returns correct plan for valid price ID', () => {
    vi.stubEnv('STRIPE_PRICE_PRO', 'price_pro_test_123');
    const result = getPlanByStripePriceId('price_pro_test_123');
    expect(result).toBeDefined();
    expect(result?.id).toBe('pro');
  });

  it('returns undefined for unknown price ID', () => {
    const result = getPlanByStripePriceId('price_nonexistent_abc');
    expect(result).toBeUndefined();
  });

  it('returns undefined when env var is not set', () => {
    vi.stubEnv('STRIPE_PRICE_STARTER', '');
    const result = getPlanByStripePriceId('price_starter_test_123');
    expect(result).toBeUndefined();
  });
});

describe('getCreditsForPlan', () => {
  it('returns 60 for pro plan', () => {
    expect(getCreditsForPlan('pro')).toBe(60);
  });

  it('returns 15 for starter plan', () => {
    expect(getCreditsForPlan('starter')).toBe(15);
  });

  it('returns 200 for business plan', () => {
    expect(getCreditsForPlan('business')).toBe(200);
  });

  it('returns -1 for enterprise plan', () => {
    expect(getCreditsForPlan('enterprise')).toBe(-1);
  });

  it('returns 3 for free plan monthly credits', async () => {
    const { getFreePlanMonthlyCredits, FREE_PLAN_MONTHLY_CREDITS } = await import('../plans');
    expect(FREE_PLAN_MONTHLY_CREDITS).toBe(3);
    expect(getFreePlanMonthlyCredits()).toBe(3);
  });
});

describe('getSelfServicePlans', () => {
  it('returns exactly 3 plans', () => {
    const plans = getSelfServicePlans();
    expect(plans).toHaveLength(3);
  });

  it('includes starter, pro, and business', () => {
    const plans = getSelfServicePlans();
    const ids = plans.map((p) => p.id);
    expect(ids).toContain('starter');
    expect(ids).toContain('pro');
    expect(ids).toContain('business');
  });

  it('excludes enterprise plan', () => {
    const plans = getSelfServicePlans();
    const ids = plans.map((p) => p.id);
    expect(ids).not.toContain('enterprise');
  });
});
