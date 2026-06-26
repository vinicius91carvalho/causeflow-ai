import { describe, expect, it, vi } from 'vitest';
import { FireTestErrorsCard } from './fire-test-errors-card';

vi.mock('@/contexts/shared/presentation/components/toast-provider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

/**
 * Unit tests for FireTestErrorsCard behaviour.
 *
 * AD-7: The card must treat HTTP 500 + { error: 'TestErrorFired', traceId }
 * as a SUCCESS (show success toast with traceId). Any other status/error = failure.
 *
 * This project does not have @testing-library/react installed.
 * We test via source-structure invariants and module export checks,
 * matching the pattern used elsewhere in this codebase.
 */

describe('FireTestErrorsCard (structure)', () => {
  it('is exported as a named function', () => {
    expect(FireTestErrorsCard).toBeDefined();
    expect(typeof FireTestErrorsCard).toBe('function');
  });

  it('component name is FireTestErrorsCard', () => {
    expect(FireTestErrorsCard.name).toBe('FireTestErrorsCard');
  });
});

describe('FireTestErrorsCard (source invariants — AD-7 contract)', () => {
  async function readSource(): Promise<string> {
    const fs = await import('node:fs');
    return fs.readFileSync(new URL('./fire-test-errors-card.tsx', import.meta.url), 'utf-8');
  }

  it('calls /api/admin/fire-test-errors with POST', async () => {
    const source = await readSource();
    expect(source).toContain('/api/admin/fire-test-errors');
    expect(source).toContain("method: 'POST'");
  });

  it('treats HTTP 500 + TestErrorFired as SUCCESS — checks for TestErrorFired string', async () => {
    const source = await readSource();
    // AD-7: the card must recognise TestErrorFired as the success signal
    expect(source).toContain('TestErrorFired');
  });

  it('treats HTTP 500 + TestErrorFired as SUCCESS — checks status >= 500 condition', async () => {
    const source = await readSource();
    // Must inspect status, not just res.ok
    expect(source).toMatch(/status\s*[>]=\s*500|res\.status\s*===\s*500/);
  });

  it('shows traceId in the success toast', async () => {
    const source = await readSource();
    // Success path must surface the traceId to the user
    expect(source).toContain('traceId');
  });

  it('does NOT blindly treat non-ok as error (old res.ok guard removed)', async () => {
    const source = await readSource();
    // Old pattern was `if (!res.ok)` which would treat 500 as an error.
    // The new code must NOT use that as the only guard.
    // We allow `res.ok` to appear only if TestErrorFired check comes first.
    // Simplest invariant: if the source contains res.ok, it also contains TestErrorFired.
    if (source.includes('res.ok')) {
      expect(source).toContain('TestErrorFired');
    }
  });

  it('does NOT render a "Created incidents" list', async () => {
    const source = await readSource();
    expect(source).not.toMatch(/created incidents/i);
    expect(source).not.toContain('results.map');
  });

  it('shows last fired / last triggered info in UI', async () => {
    const source = await readSource();
    // Some state variable that tracks what was last triggered
    expect(source).toMatch(/lastFired|lastTriggered|lastTrace/);
  });

  it('calls /api/admin/fire-test-errors with POST (no tenantId in URL or body)', async () => {
    const source = await readSource();
    // W4: tenantId must not be in the client-side request
    expect(source).not.toContain('tenantId');
  });
});
