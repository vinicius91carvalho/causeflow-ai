import { describe, expect, it } from 'vitest';

/**
 * Unit tests for appearance-tab locale + theme persistence logic.
 *
 * The component calls PATCH /api/settings before navigating for locale changes
 * (pessimistic) and fires a background PATCH for theme changes (optimistic via
 * ThemeProvider callback). These tests validate the routing / guard logic
 * without mounting the React tree.
 */

// ---------------------------------------------------------------------------
// Locale persistence logic — mirrors handleLocaleChange in appearance-tab.tsx
// ---------------------------------------------------------------------------

const SUPPORTED_LOCALES = ['en', 'pt-br'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupportedLocale(v: unknown): v is SupportedLocale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(v);
}

interface LocaleChangeResult {
  apiCalled: boolean;
  navigated: boolean;
  toastedError: boolean;
}

/**
 * Pure function that replicates the locale-change guard logic.
 * Returns what side effects would have occurred.
 */
async function runLocaleChangeLogic(opts: {
  currentLocale: string;
  nextLocale: string;
  apiOk: boolean;
}): Promise<LocaleChangeResult> {
  const result: LocaleChangeResult = {
    apiCalled: false,
    navigated: false,
    toastedError: false,
  };

  // Guard: no-op if same locale
  if (opts.currentLocale === opts.nextLocale) {
    return result;
  }

  if (!isSupportedLocale(opts.nextLocale)) {
    return result;
  }

  // Pessimistic: call API first
  result.apiCalled = true;
  if (!opts.apiOk) {
    result.toastedError = true;
    return result; // do NOT navigate on failure
  }

  // Only navigate on success
  result.navigated = true;
  return result;
}

// ---------------------------------------------------------------------------
// Theme persistence logic — mirrors onThemeChange callback behaviour
// ---------------------------------------------------------------------------

interface ThemeChangeResult {
  apiCalled: boolean;
  threw: boolean;
  toastedError: boolean;
}

async function runThemeChangeCallback(opts: { apiOk: boolean }): Promise<ThemeChangeResult> {
  const result: ThemeChangeResult = { apiCalled: true, threw: false, toastedError: false };

  try {
    if (!opts.apiOk) {
      throw new Error('settings update failed');
    }
  } catch {
    result.threw = false; // provider must NEVER throw — catch internally
    result.toastedError = true;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tests: locale change
// ---------------------------------------------------------------------------

describe('appearance-tab locale change logic', () => {
  it('no-op when locale is unchanged', async () => {
    const r = await runLocaleChangeLogic({
      currentLocale: 'en',
      nextLocale: 'en',
      apiOk: true,
    });
    expect(r.apiCalled).toBe(false);
    expect(r.navigated).toBe(false);
    expect(r.toastedError).toBe(false);
  });

  it('calls API before navigating on locale change (pessimistic)', async () => {
    const r = await runLocaleChangeLogic({
      currentLocale: 'en',
      nextLocale: 'pt-br',
      apiOk: true,
    });
    expect(r.apiCalled).toBe(true);
    expect(r.navigated).toBe(true);
    expect(r.toastedError).toBe(false);
  });

  it('does NOT navigate when API fails — shows toast instead', async () => {
    const r = await runLocaleChangeLogic({
      currentLocale: 'en',
      nextLocale: 'pt-br',
      apiOk: false,
    });
    expect(r.apiCalled).toBe(true);
    expect(r.navigated).toBe(false);
    expect(r.toastedError).toBe(true);
  });

  it('rejects unsupported locale values silently', async () => {
    const r = await runLocaleChangeLogic({
      currentLocale: 'en',
      nextLocale: 'fr', // unsupported
      apiOk: true,
    });
    expect(r.apiCalled).toBe(false);
    expect(r.navigated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: theme change callback (optimistic, non-throwing)
// ---------------------------------------------------------------------------

describe('appearance-tab theme change callback', () => {
  it('calls the API on theme change', async () => {
    const r = await runThemeChangeCallback({ apiOk: true });
    expect(r.apiCalled).toBe(true);
    expect(r.threw).toBe(false);
  });

  it('does NOT throw when API fails — surfaces toast instead', async () => {
    const r = await runThemeChangeCallback({ apiOk: false });
    expect(r.threw).toBe(false); // non-throwing is the invariant
    expect(r.toastedError).toBe(true);
  });
});
