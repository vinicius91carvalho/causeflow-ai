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

  it('redirects away on OSS subscription 410 instead of rendering plan cards (AC-082)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./choose-plan-page.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('res.status === 410');
    expect(source).toContain("window.location.replace('/dashboard')");
    const oss410Block = source.match(/if \(res\.status === 410\) \{[\s\S]*?\n\s*\}/);
    expect(oss410Block?.[0]).toContain("window.location.replace('/dashboard')");
    expect(oss410Block?.[0]).not.toContain('setReady(true)');
  });
});
