import { describe, expect, it } from 'vitest';
import type { EmptyStateBranch } from './empty-state-branch';
import { selectEmptyStateBranch } from './empty-state-branch';

describe('selectEmptyStateBranch', () => {
  it('returns A when hasAnalyses=false and hasIntegrations=false', () => {
    const result: EmptyStateBranch = selectEmptyStateBranch({
      hasAnalyses: false,
      hasIntegrations: false,
    });
    expect(result).toBe('A');
  });

  it('returns B when hasAnalyses=false and hasIntegrations=true', () => {
    const result: EmptyStateBranch = selectEmptyStateBranch({
      hasAnalyses: false,
      hasIntegrations: true,
    });
    expect(result).toBe('B');
  });

  it('returns C when hasAnalyses=true and hasIntegrations=false (degenerate — analyses imply something happened)', () => {
    const result: EmptyStateBranch = selectEmptyStateBranch({
      hasAnalyses: true,
      hasIntegrations: false,
    });
    expect(result).toBe('C');
  });

  it('returns C when hasAnalyses=true and hasIntegrations=true', () => {
    const result: EmptyStateBranch = selectEmptyStateBranch({
      hasAnalyses: true,
      hasIntegrations: true,
    });
    expect(result).toBe('C');
  });
});
