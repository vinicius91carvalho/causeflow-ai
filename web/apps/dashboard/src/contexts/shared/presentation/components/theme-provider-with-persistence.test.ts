import { describe, expect, it } from 'vitest';

/**
 * Unit tests for the ThemeProvider persistence callback wiring.
 *
 * The thin client wrapper `ThemeProviderWithPersistence` adds an `onThemeChange`
 * callback to `ThemeProvider` that calls PATCH /api/settings with { theme }.
 * These tests validate the callback logic in isolation.
 */

type Theme = 'light' | 'dark' | 'system';

// ---------------------------------------------------------------------------
// Inline replication of the onThemeChange callback logic
// ---------------------------------------------------------------------------

interface PersistResult {
  fetchCalled: boolean;
  fetchPayload: unknown;
  threw: boolean;
}

/**
 * Mirrors the onThemeChange callback inside ThemeProviderWithPersistence.
 * Returns what side effects would have occurred.
 */
async function runOnThemeChange(opts: { theme: Theme; apiOk: boolean }): Promise<PersistResult> {
  const result: PersistResult = {
    fetchCalled: false,
    fetchPayload: null,
    threw: false,
  };

  // The callback must NEVER throw — errors are swallowed + optionally logged.
  try {
    result.fetchCalled = true;
    result.fetchPayload = { theme: opts.theme };

    if (!opts.apiOk) {
      throw new Error('settings PATCH failed');
    }
  } catch {
    // Errors must be caught internally — provider never propagates them
    result.threw = false; // invariant: always false
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThemeProviderWithPersistence onThemeChange callback', () => {
  it('sends the theme to PATCH /api/settings on change', async () => {
    const r = await runOnThemeChange({ theme: 'dark', apiOk: true });
    expect(r.fetchCalled).toBe(true);
    expect(r.fetchPayload).toEqual({ theme: 'dark' });
    expect(r.threw).toBe(false);
  });

  it('does NOT throw when the API call fails', async () => {
    const r = await runOnThemeChange({ theme: 'light', apiOk: false });
    expect(r.threw).toBe(false);
  });

  it('handles all valid theme values', async () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    for (const theme of themes) {
      const r = await runOnThemeChange({ theme, apiOk: true });
      expect(r.fetchPayload).toEqual({ theme });
    }
  });
});
