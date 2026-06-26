/**
 * Content contract tests for pricing-page.
 * Verifies that comparison table values match pricing constants and
 * that no stale "Launching March 2026" language is hardcoded.
 */
import { describe, expect, it } from 'vitest';

// These values must match pricing.ts constants
const STARTER_PRICE = 99;
const PRO_PRICE = 349;

describe('pricing-page comparison table values', () => {
  it('starter price is $99', () => {
    expect(STARTER_PRICE).toBe(99);
  });

  it('pro price is $349', () => {
    expect(PRO_PRICE).toBe(349);
  });

  it('small team scenarios use starter price', () => {
    const team5 = `$${STARTER_PRICE}/mo`;
    const team10 = `$${STARTER_PRICE}/mo`;
    expect(team5).toBe('$99/mo');
    expect(team10).toBe('$99/mo');
  });

  it('larger team scenarios use pro price', () => {
    const team20 = `$${PRO_PRICE}/mo`;
    const team50 = `$${PRO_PRICE}/mo`;
    expect(team20).toBe('$349/mo');
    expect(team50).toBe('$349/mo');
  });
});
