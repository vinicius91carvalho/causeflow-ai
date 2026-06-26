import { describe, expect, it } from 'vitest';
import { onboardingPatchSchema } from './api-schema';

describe('Onboarding API Schema', () => {
  it('accepts start action', () => {
    const result = onboardingPatchSchema.safeParse({ action: 'start' });
    expect(result.success).toBe(true);
  });

  it('accepts complete action with step', () => {
    const result = onboardingPatchSchema.safeParse({
      action: 'complete',
      step: 'integrations',
    });
    expect(result.success).toBe(true);
  });

  it('accepts skip action with step', () => {
    const result = onboardingPatchSchema.safeParse({
      action: 'skip',
      step: 'relay',
    });
    expect(result.success).toBe(true);
  });

  it('accepts skip_all action without step', () => {
    const result = onboardingPatchSchema.safeParse({ action: 'skip_all' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action', () => {
    const result = onboardingPatchSchema.safeParse({ action: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid step key', () => {
    const result = onboardingPatchSchema.safeParse({
      action: 'complete',
      step: 'nonexistent',
    });
    expect(result.success).toBe(false);
  });

  it('allows step to be optional for start/skip_all', () => {
    expect(onboardingPatchSchema.safeParse({ action: 'start' }).success).toBe(true);
    expect(onboardingPatchSchema.safeParse({ action: 'skip_all' }).success).toBe(true);
  });
});
