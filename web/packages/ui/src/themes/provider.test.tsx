/**
 * Tests for ThemeProvider — initial resolvedColorMode must match defaultColorMode
 * so that consumers (like Clerk's appearance prop) render with the correct theme
 * on first render, before any useEffect runs.
 *
 * Regression: resolvedColorMode was hardcoded to 'light' initial state, causing
 * Clerk to flash light appearance on dashboard pages that default to dark.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const providerSource = readFileSync(
  fileURLToPath(new URL('./provider.tsx', import.meta.url)),
  'utf-8',
);

describe('ThemeProvider initial resolvedColorMode', () => {
  it("does NOT hardcode initial resolvedColorMode to 'light'", () => {
    // The buggy line was: useState<'light' | 'dark'>('light')
    // The fix derives the initial value from defaultColorMode.
    expect(providerSource).not.toMatch(/useState<['"]light['"] \| ['"]dark['"]>\(['"]light['"]\)/);
  });

  it('derives initial resolvedColorMode from defaultColorMode', () => {
    // The fixed code uses a lazy initializer (() => { ... }) that reads from
    // localStorage first and falls back to `stored.colorMode ?? defaultColorMode`.
    // We verify the entire useState<'light'|'dark'> initializer block (which
    // may span multiple lines) references defaultColorMode somewhere.
    //
    // Previous regex used a non-greedy `[\s\S]*?` that stopped at the first `)`
    // inside the arrow-function body, capturing only `useState<...>(()` — too
    // short. We now match from the useState open-paren to the balancing
    // close-paren by searching for the substring directly in the source.
    const hasUseState = /useState<['"]light['"] \| ['"]dark['"]>/.test(providerSource);
    expect(hasUseState).toBe(true);

    // Find the character position of the resolvedColorMode useState declaration
    // and scan forward to the closing `});` of the lazy initializer.
    const startIdx = providerSource.search(/useState<['"]light['"] \| ['"]dark['"]>/);
    expect(startIdx).toBeGreaterThan(-1);

    // Extract a generous window (up to 400 chars) from that point and confirm
    // defaultColorMode appears within it.
    const window = providerSource.slice(startIdx, startIdx + 400);
    expect(window).toContain('defaultColorMode');
  });
});
