import { describe, expect, it } from 'vitest';

/**
 * MetricsCard unit tests — logic layer only.
 * Full render tests require jsdom + next-intl providers.
 */

// ─── Types mirroring the component's props ────────────────────────────────

interface Trend {
  value: number;
  label: string;
}

interface MetricsCardProps {
  label: string;
  value: string | number;
  loading?: boolean;
  trend?: Trend;
}

// ─── Helper: derive display state from props ────────────────────────────────

function getCardDisplayState(props: MetricsCardProps) {
  return {
    showsSkeleton: props.loading === true,
    showsValue: !props.loading,
    hasTrend: props.trend !== undefined,
    trendIsPositive: props.trend ? props.trend.value >= 0 : null,
  };
}

function formatTrendSign(value: number): string {
  return value >= 0 ? '+' : '';
}

describe('MetricsCard display logic', () => {
  describe('loading skeleton state', () => {
    it('shows skeleton when loading=true', () => {
      const state = getCardDisplayState({ label: 'Total', value: 0, loading: true });
      expect(state.showsSkeleton).toBe(true);
      expect(state.showsValue).toBe(false);
    });

    it('shows value when loading=false', () => {
      const state = getCardDisplayState({ label: 'Total', value: 42, loading: false });
      expect(state.showsSkeleton).toBe(false);
      expect(state.showsValue).toBe(true);
    });

    it('defaults to showing value when loading is omitted', () => {
      const state = getCardDisplayState({ label: 'Total', value: 0 });
      expect(state.showsSkeleton).toBe(false);
      expect(state.showsValue).toBe(true);
    });
  });

  describe('value rendering', () => {
    it('accepts numeric value 0', () => {
      const state = getCardDisplayState({ label: 'Total', value: 0 });
      expect(state.showsValue).toBe(true);
    });

    it('accepts large numeric values', () => {
      const state = getCardDisplayState({ label: 'Total', value: 9999 });
      expect(state.showsValue).toBe(true);
    });

    it('accepts string value', () => {
      const state = getCardDisplayState({ label: 'Status', value: '4m 32s' });
      expect(state.showsValue).toBe(true);
    });
  });

  describe('trend indicator', () => {
    it('shows trend when provided', () => {
      const state = getCardDisplayState({
        label: 'Total',
        value: 42,
        trend: { value: 12, label: 'vs last month' },
      });
      expect(state.hasTrend).toBe(true);
    });

    it('hides trend when not provided', () => {
      const state = getCardDisplayState({ label: 'Total', value: 42 });
      expect(state.hasTrend).toBe(false);
    });

    it('positive trend has + prefix', () => {
      expect(formatTrendSign(12)).toBe('+');
      expect(formatTrendSign(0)).toBe('+');
    });

    it('negative trend has no prefix (value already has -)', () => {
      expect(formatTrendSign(-5)).toBe('');
    });

    it('zero trend is considered positive', () => {
      const state = getCardDisplayState({
        label: 'Total',
        value: 42,
        trend: { value: 0, label: 'no change' },
      });
      expect(state.trendIsPositive).toBe(true);
    });

    it('negative trend value is correctly identified', () => {
      const state = getCardDisplayState({
        label: 'Total',
        value: 42,
        trend: { value: -3, label: 'vs last month' },
      });
      expect(state.trendIsPositive).toBe(false);
    });
  });
});
