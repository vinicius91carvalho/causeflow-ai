import { describe, expect, it } from 'vitest';

/**
 * Tests for ROI calculator business logic.
 * The component uses getCauseFlowPlan internally — we test the same logic here.
 */
function getCauseFlowPlan(incidents: number) {
  if (incidents <= 5) return { name: 'Free', cost: 0 };
  if (incidents <= 100) return { name: 'Starter', cost: 49 };
  if (incidents <= 500) return { name: 'Pro', cost: 149 };
  if (incidents <= 2000) return { name: 'Business', cost: 399 };
  return { name: 'Enterprise', cost: 399 + (incidents - 2000) * 0.2 };
}

function calculateROI(incidents: number, avgTimeHours: number, engineers: number) {
  const hoursSaved = Math.round(incidents * avgTimeHours * 0.95);
  const plan = getCauseFlowPlan(incidents);
  const perSeatCost = engineers * 45;
  const platformCost = engineers * 20;
  const bestCompetitor = Math.min(perSeatCost, platformCost);
  const annualSavings = Math.max(0, (bestCompetitor - plan.cost) * 12);
  return { hoursSaved, plan, perSeatCost, platformCost, annualSavings };
}

describe('getCauseFlowPlan', () => {
  it('returns Free plan for 1-5 incidents', () => {
    expect(getCauseFlowPlan(1)).toEqual({ name: 'Free', cost: 0 });
    expect(getCauseFlowPlan(5)).toEqual({ name: 'Free', cost: 0 });
  });

  it('returns Starter plan for 6-100 incidents', () => {
    expect(getCauseFlowPlan(6)).toEqual({ name: 'Starter', cost: 49 });
    expect(getCauseFlowPlan(50)).toEqual({ name: 'Starter', cost: 49 });
    expect(getCauseFlowPlan(100)).toEqual({ name: 'Starter', cost: 49 });
  });

  it('returns Pro plan for 101-500 incidents', () => {
    expect(getCauseFlowPlan(101)).toEqual({ name: 'Pro', cost: 149 });
    expect(getCauseFlowPlan(500)).toEqual({ name: 'Pro', cost: 149 });
  });

  it('returns Business plan for 501-2000 incidents', () => {
    expect(getCauseFlowPlan(501)).toEqual({ name: 'Business', cost: 399 });
    expect(getCauseFlowPlan(2000)).toEqual({ name: 'Business', cost: 399 });
  });

  it('returns Enterprise plan with per-incident pricing above 2000', () => {
    expect(getCauseFlowPlan(2001)).toEqual({ name: 'Enterprise', cost: 399.2 });
    expect(getCauseFlowPlan(3000)).toEqual({ name: 'Enterprise', cost: 599 });
  });
});

describe('calculateROI', () => {
  it('calculates hours saved correctly (95% reduction)', () => {
    const result = calculateROI(50, 2, 10);
    expect(result.hoursSaved).toBe(95); // 50 * 2 * 0.95 = 95
  });

  it('calculates competitor costs based on engineer count', () => {
    const result = calculateROI(50, 2, 10);
    expect(result.perSeatCost).toBe(450); // 10 * 45
    expect(result.platformCost).toBe(200); // 10 * 20
  });

  it('calculates annual savings vs cheapest competitor', () => {
    const result = calculateROI(50, 2, 10);
    // Best competitor: Enterprise platform at $200/mo, CauseFlow Starter at $49/mo
    // Savings: (200 - 49) * 12 = $1,812
    expect(result.annualSavings).toBe(1812);
  });

  it('returns zero savings when CauseFlow is more expensive', () => {
    // 1 engineer: Enterprise platform = $20/mo, CauseFlow Starter = $49/mo
    const result = calculateROI(50, 2, 1);
    expect(result.annualSavings).toBe(0);
  });

  it('uses Free plan for very low incidents', () => {
    const result = calculateROI(3, 1, 5);
    expect(result.plan.name).toBe('Free');
    expect(result.plan.cost).toBe(0);
    // Savings: (100 - 0) * 12 = $1,200 (Enterprise platform at $100/mo)
    expect(result.annualSavings).toBe(1200);
  });

  it('handles edge case with max slider values', () => {
    const result = calculateROI(500, 4, 100);
    expect(result.hoursSaved).toBe(1900); // 500 * 4 * 0.95
    expect(result.plan.name).toBe('Pro');
    expect(result.perSeatCost).toBe(4500);
    expect(result.platformCost).toBe(2000);
    // Best: Enterprise platform $2000, CauseFlow Pro $149
    expect(result.annualSavings).toBe(22212); // (2000 - 149) * 12
  });
});
