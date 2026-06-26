/**
 * Source-level tests for AnimateOnScroll.
 *
 * Regression: the component previously rendered hidden classes (opacity-0 +
 * translate) as the SSR initial state, relying on a client-side useLayoutEffect
 * to flip to visible. That caused blank-below-the-fold pages for pre-hydration
 * captures (Playwright), bots, and slow-JS users. The fix makes SSR render
 * visible and the hidden state is a strictly post-hydration progressive
 * enhancement.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const componentSource = readFileSync(
  fileURLToPath(new URL('./animate-on-scroll.tsx', import.meta.url)),
  'utf-8',
);

describe('AnimateOnScroll source contract', () => {
  it('consumes isMounted from the hook', () => {
    expect(componentSource).toMatch(/const\s+\{[^}]*isMounted[^}]*\}\s*=\s*useAnimateOnScroll/);
  });

  it('renders as visible when !isMounted (SSR + first paint)', () => {
    // The visible-gating boolean must evaluate to true when isMounted is false.
    // The fix uses: `const showAsVisible = !isMounted || skipAnimation || isVisible;`
    expect(componentSource).toMatch(
      /showAsVisible\s*=\s*!isMounted\s*\|\|\s*skipAnimation\s*\|\|\s*isVisible/,
    );
  });

  it('applies transition classes only when isMounted is true and animation is not skipped', () => {
    // Prevents transition-all from shipping on SSR, which can cause a visible
    // flash of the hidden → visible transition on hydration.
    expect(componentSource).toMatch(
      /isMounted\s*&&\s*!skipAnimation\s*\?\s*['"]transition-all['"]/,
    );
  });

  it('does not rely on the previous hidden-first pattern (regression guard)', () => {
    // The buggy line was: `skipAnimation || isVisible ? v.visible : v.hidden`
    // WITHOUT the isMounted gate — SSR rendered v.hidden by default.
    // The fixed code uses showAsVisible. Assert the old pattern is gone.
    const hasOldPattern =
      /className=\{cn\([\s\S]*?skipAnimation\s*\?\s*['"]{2}\s*:\s*['"]transition-all['"][\s\S]*?\)/.test(
        componentSource,
      );
    expect(hasOldPattern).toBe(false);
  });
});
