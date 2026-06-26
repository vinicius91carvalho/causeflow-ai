import { describe, expect, it } from 'vitest';

/**
 * Unit tests for middleware helper logic.
 *
 * The full middleware cannot be unit-tested directly because it uses Clerk
 * and Next.js internals. These tests cover the pure helper functions that
 * drive locale handling. Plan-gate enforcement lives in the dashboard layout
 * server component — see app/[locale]/dashboard/layout.tsx — and is tested
 * via `plan-status.test.ts`.
 *
 * Full integration testing requires E2E (Playwright) against a running server.
 */

// ---------------------------------------------------------------------------
// Helpers — replicate the logic from middleware.ts so it can be unit-tested
// ---------------------------------------------------------------------------

const SUPPORTED_LOCALES = ['en', 'pt-br'] as const;

function stripLocale(pathname: string): string {
  for (const locale of SUPPORTED_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || '/';
    }
  }
  return pathname;
}

// ---------------------------------------------------------------------------
// stripLocale
// ---------------------------------------------------------------------------

describe('stripLocale', () => {
  it('strips /en prefix', () => {
    expect(stripLocale('/en/dashboard')).toBe('/dashboard');
  });

  it('strips /pt-br prefix', () => {
    expect(stripLocale('/pt-br/dashboard')).toBe('/dashboard');
  });

  it('leaves bare paths unchanged', () => {
    expect(stripLocale('/dashboard')).toBe('/dashboard');
    expect(stripLocale('/onboarding/choose-plan')).toBe('/onboarding/choose-plan');
  });

  it('handles locale-only paths', () => {
    expect(stripLocale('/en')).toBe('/');
    expect(stripLocale('/pt-br')).toBe('/');
  });
});
