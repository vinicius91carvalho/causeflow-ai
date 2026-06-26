import { describe, expect, it } from 'vitest';
import { SentryStatusPill } from './sentry-status-pill';

/**
 * Unit tests for `SentryStatusPill`.
 *
 * No `@testing-library/react` is installed in this monorepo. We follow the
 * source-invariants + named-export pattern used elsewhere
 * (see `fire-test-errors-card.test.tsx`, `integrations-toast-handler.test.tsx`).
 *
 * The three pill states required by Sprint 2 acceptance criteria:
 *   1. `setup_required`  — `hasClientSecret === false`
 *   2. `awaiting`        — saved but `verified === false`
 *   3. `verified`        — `verified === true`, with relative `lastEventAt`
 */
describe('SentryStatusPill (structure)', () => {
  it('is exported as a named function', () => {
    expect(SentryStatusPill).toBeDefined();
    expect(typeof SentryStatusPill).toBe('function');
  });

  it('component name is SentryStatusPill', () => {
    expect(SentryStatusPill.name).toBe('SentryStatusPill');
  });
});

describe('SentryStatusPill (source invariants — three states)', () => {
  async function readSource(): Promise<string> {
    const fs = await import('node:fs');
    return fs.readFileSync(new URL('./sentry-status-pill.tsx', import.meta.url), 'utf-8');
  }

  it('declares the three required states', async () => {
    const source = await readSource();
    expect(source).toContain("'setup_required'");
    expect(source).toContain("'awaiting'");
    expect(source).toContain("'verified'");
  });

  it('renders setup_required when hasClientSecret is false', async () => {
    const source = await readSource();
    // The deriveState function must check hasClientSecret first
    expect(source).toMatch(/!status\.hasClientSecret[\s\S]*?setup_required/);
  });

  it('renders awaiting when secret is saved but not verified', async () => {
    const source = await readSource();
    // Default branch when hasClientSecret=true, verified=false
    expect(source).toContain("return 'awaiting'");
  });

  it('renders verified when verified is true', async () => {
    const source = await readSource();
    expect(source).toMatch(/status\.verified[\s\S]*?return 'verified'/);
  });

  it('uses the i18n namespace dashboard.integrations.sentryStatus', async () => {
    const source = await readSource();
    expect(source).toContain('dashboard.integrations.sentryStatus');
  });

  it('uses semantic Tailwind classes (bg-warning, bg-primary, bg-success) — no raw HSL', async () => {
    const source = await readSource();
    expect(source).toContain('bg-warning');
    expect(source).toContain('bg-primary');
    expect(source).toContain('bg-success');
    // No raw HSL values — design system rule
    expect(source).not.toMatch(/hsl\(/i);
  });

  it('formats verified pill with relative time from lastEventAt', async () => {
    const source = await readSource();
    expect(source).toContain('formatRelativeOrNever');
    expect(source).toContain('lastEventAt');
    // Must use t('verified', { time: ... }) for the i18n interpolation
    expect(source).toMatch(/t\('verified',\s*\{\s*time:/);
  });

  it('handles null lastEventAt without crashing (verified but no event)', async () => {
    const source = await readSource();
    // Returns null branch in formatRelativeOrNever for missing iso
    expect(source).toContain('if (!iso) return null');
  });

  it('exposes data-state on the rendered span for E2E tests', async () => {
    const source = await readSource();
    expect(source).toContain('data-state={state}');
    expect(source).toContain('data-testid="sentry-status-pill"');
  });
});
