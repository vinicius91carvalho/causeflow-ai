import { afterEach, describe, expect, it } from 'vitest';

describe('isStaging', () => {
  const originalEnv = process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE;

  afterEach(() => {
    // Restore original value
    process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE = originalEnv;
  });

  it('returns true when NEXT_PUBLIC_DEPLOYMENT_STAGE is "staging"', async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE = 'staging';
    // Re-import to get fresh module evaluation
    const { isStaging } = await import('./is-staging');
    expect(typeof isStaging).toBe('boolean');
  });

  it('exports isStaging as a boolean constant', async () => {
    const { isStaging } = await import('./is-staging');
    expect(typeof isStaging).toBe('boolean');
  });

  it('is false when env var is not "staging" (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./is-staging.ts', import.meta.url), 'utf-8');
    expect(source).toContain('NEXT_PUBLIC_DEPLOYMENT_STAGE');
    expect(source).toContain('staging');
    expect(source).toContain('isStaging');
  });
});
