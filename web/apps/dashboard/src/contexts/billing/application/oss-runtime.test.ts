import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOssBuildClient, isOssRuntime } from './oss-runtime';

describe('oss-runtime', () => {
  const originalRuntime = process.env.CAUSEFLOW_RUNTIME;
  const originalStripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  beforeEach(() => {
    delete process.env.CAUSEFLOW_RUNTIME;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  });

  afterEach(() => {
    if (originalRuntime === undefined) delete process.env.CAUSEFLOW_RUNTIME;
    else process.env.CAUSEFLOW_RUNTIME = originalRuntime;
    if (originalStripeKey === undefined) delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalStripeKey;
  });

  it('isOssBuildClient is true when Stripe publishable key is absent', () => {
    expect(isOssBuildClient()).toBe(true);
  });

  it('isOssBuildClient is false when Stripe publishable key is set', () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    expect(isOssBuildClient()).toBe(false);
  });

  it('isOssRuntime honors CAUSEFLOW_RUNTIME=oss', () => {
    process.env.CAUSEFLOW_RUNTIME = 'oss';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    expect(isOssRuntime()).toBe(true);
  });
});
