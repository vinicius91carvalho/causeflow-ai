import { describe, expect, it } from 'vitest';
import type { ICoreApiClient } from './core-api-client';

describe('ICoreApiClient interface', () => {
  it('has createSubscription method signature', () => {
    // Type-level test: verify the method exists on the interface
    type HasCreateSubscription = ICoreApiClient extends {
      createSubscription(body: {
        planId: string;
      }): Promise<{ subscriptionId: string; clientSecret: string; status: string }>;
    }
      ? true
      : false;

    const check: HasCreateSubscription = true;
    expect(check).toBe(true);
  });
});
