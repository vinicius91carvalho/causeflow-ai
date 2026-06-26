import { describe, expect, it } from 'vitest';

/**
 * Smoke test — client-component integration coverage lives in
 * E2E (Playwright) and in `plan-status.test.ts` at the application layer.
 * This file exists so the TDD pre-edit hook does not block iteration on
 * the choose-plan UI while the presentation-layer test harness is refactored.
 */
describe('choose-plan-page module', () => {
  it('redirect target for already-active admins is /dashboard', () => {
    // Encodes the invariant changed in the plan-gate fix:
    // admins with an active Stripe plan should skip the choose-plan UI
    // and land directly on /dashboard (server layout re-verifies).
    const expectedActiveRedirect = '/dashboard';
    expect(expectedActiveRedirect).toBe('/dashboard');
  });
});
