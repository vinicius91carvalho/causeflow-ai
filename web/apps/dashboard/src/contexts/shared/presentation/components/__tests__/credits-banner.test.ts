import { describe, expect, it } from 'vitest';

/**
 * CreditsBanner unit tests — logic layer only.
 * Full render tests require jsdom + next-intl providers.
 */

type CreditState = 'normal' | 'warning' | 'critical';

function getCreditState(creditsTotal: number, creditsUsed: number): CreditState {
  if (creditsTotal === 0) return 'normal';
  const percentRemaining = ((creditsTotal - creditsUsed) / creditsTotal) * 100;
  if (percentRemaining < 5) return 'critical';
  if (percentRemaining < 20) return 'warning';
  return 'normal';
}

function getPercentRemaining(creditsTotal: number, creditsUsed: number): number {
  if (creditsTotal === 0) return 100;
  return Math.max(0, ((creditsTotal - creditsUsed) / creditsTotal) * 100);
}

function getCreditsRemaining(creditsTotal: number, creditsUsed: number): number {
  return Math.max(0, creditsTotal - creditsUsed);
}

describe('CreditsBanner logic', () => {
  describe('credit state determination', () => {
    it('normal state when > 20% remaining', () => {
      // 100 total, 50 used = 50% remaining
      expect(getCreditState(100, 50)).toBe('normal');
    });

    it('normal state when exactly 100% remaining', () => {
      expect(getCreditState(100, 0)).toBe('normal');
    });

    it('warning state when < 20% remaining', () => {
      // 100 total, 85 used = 15% remaining
      expect(getCreditState(100, 85)).toBe('warning');
    });

    it('warning state when exactly 19% remaining', () => {
      // 100 total, 81 used = 19% remaining
      expect(getCreditState(100, 81)).toBe('warning');
    });

    it('critical state when < 5% remaining', () => {
      // 100 total, 97 used = 3% remaining
      expect(getCreditState(100, 97)).toBe('critical');
    });

    it('critical state when 0 remaining', () => {
      expect(getCreditState(100, 100)).toBe('critical');
    });

    it('normal state when creditsTotal is 0 (edge case)', () => {
      expect(getCreditState(0, 0)).toBe('normal');
    });
  });

  describe('percent remaining calculation', () => {
    it('100% when nothing used', () => {
      expect(getPercentRemaining(100, 0)).toBe(100);
    });

    it('50% when half used', () => {
      expect(getPercentRemaining(100, 50)).toBe(50);
    });

    it('0% when all used', () => {
      expect(getPercentRemaining(100, 100)).toBe(0);
    });

    it('never goes below 0 even if overused', () => {
      expect(getPercentRemaining(100, 120)).toBe(0);
    });

    it('100% when total is 0 (avoids division by zero)', () => {
      expect(getPercentRemaining(0, 0)).toBe(100);
    });
  });

  describe('credits remaining calculation', () => {
    it('calculates remaining correctly', () => {
      expect(getCreditsRemaining(100, 30)).toBe(70);
    });

    it('returns 0 when exactly used up', () => {
      expect(getCreditsRemaining(100, 100)).toBe(0);
    });

    it('never returns negative', () => {
      expect(getCreditsRemaining(100, 150)).toBe(0);
    });
  });

  describe('state thresholds', () => {
    const cases: Array<{ used: number; expected: CreditState; description: string }> = [
      { used: 0, expected: 'normal', description: '0% used' },
      { used: 60, expected: 'normal', description: '60% used (40% remaining)' },
      { used: 80, expected: 'normal', description: '80% used (20% remaining — boundary)' },
      { used: 81, expected: 'warning', description: '81% used (19% remaining)' },
      { used: 94, expected: 'warning', description: '94% used (6% remaining)' },
      { used: 95, expected: 'warning', description: '95% used (5% remaining — boundary)' },
      { used: 96, expected: 'critical', description: '96% used (4% remaining)' },
      { used: 100, expected: 'critical', description: '100% used' },
    ];

    for (const { used, expected, description } of cases) {
      it(`${description} → ${expected}`, () => {
        expect(getCreditState(100, used)).toBe(expected);
      });
    }
  });
});
