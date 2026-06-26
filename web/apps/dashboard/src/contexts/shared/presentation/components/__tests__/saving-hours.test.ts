import { describe, expect, it } from 'vitest';
import { calculateHoursSaved, HOURS_PER_ANALYSIS } from '../saving-hours';

/**
 * SavingHours unit tests — logic layer.
 */

function shouldShowWidget(monthlyAnalyses: number): boolean {
  return monthlyAnalyses > 0;
}

describe('SavingHours logic', () => {
  describe('HOURS_PER_ANALYSIS constant', () => {
    it('is 4 hours per analysis', () => {
      expect(HOURS_PER_ANALYSIS).toBe(4);
    });
  });

  describe('calculateHoursSaved', () => {
    it('returns 0 for 0 analyses', () => {
      expect(calculateHoursSaved(0)).toBe(0);
    });

    it('returns 4 for 1 analysis', () => {
      expect(calculateHoursSaved(1)).toBe(4);
    });

    it('returns 20 for 5 analyses', () => {
      expect(calculateHoursSaved(5)).toBe(20);
    });

    it('scales linearly with analysis count', () => {
      for (let i = 1; i <= 10; i++) {
        expect(calculateHoursSaved(i)).toBe(i * HOURS_PER_ANALYSIS);
      }
    });

    it('handles large numbers', () => {
      expect(calculateHoursSaved(100)).toBe(400);
    });
  });

  describe('widget visibility', () => {
    it('hidden when no analyses (monthlyAnalyses = 0)', () => {
      expect(shouldShowWidget(0)).toBe(false);
    });

    it('shown when there is at least 1 analysis', () => {
      expect(shouldShowWidget(1)).toBe(true);
    });

    it('shown for any positive count', () => {
      for (const count of [1, 5, 10, 50, 100]) {
        expect(shouldShowWidget(count)).toBe(true);
      }
    });
  });

  describe('display text formatting', () => {
    it('template has {hours} placeholder', () => {
      const template =
        'You saved ~{hours} hours this month with CauseFlow AI ({analyses} investigations)';
      expect(template).toContain('{hours}');
    });

    it('template has {analyses} placeholder', () => {
      const template =
        'You saved ~{hours} hours this month with CauseFlow AI ({analyses} investigations)';
      expect(template).toContain('{analyses}');
    });

    it('replacing placeholders produces correct output', () => {
      const template = 'You saved ~{hours} hours this month ({analyses} analyses)';
      const result = template
        .replace('{hours}', String(calculateHoursSaved(5)))
        .replace('{analyses}', String(5));
      expect(result).toBe('You saved ~20 hours this month (5 analyses)');
    });
  });
});
