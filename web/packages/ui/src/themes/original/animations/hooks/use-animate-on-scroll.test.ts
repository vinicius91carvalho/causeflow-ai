/**
 * Source-level tests for useAnimateOnScroll.
 *
 * Regression: the hook previously exposed only `isVisible`/`alreadyVisible`/
 * `prefersReducedMotion`, forcing the AnimateOnScroll component to render the
 * hidden CSS class on SSR. That caused blank-below-the-fold pages for bots,
 * slow-JS users, and pre-hydration Playwright screenshots. The fix adds an
 * `isMounted` state so the wrapping component can gate the hidden class on
 * hydration having occurred.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const hookSource = readFileSync(
  fileURLToPath(new URL('./use-animate-on-scroll.ts', import.meta.url)),
  'utf-8',
);

describe('useAnimateOnScroll hook source contract', () => {
  it('declares an isMounted state that defaults to false', () => {
    expect(hookSource).toMatch(/const\s+\[isMounted,\s*setIsMounted\]\s*=\s*useState\(false\)/);
  });

  it('returns isMounted from the hook API', () => {
    // The return object must include isMounted so the component can gate SSR
    // behavior on hydration completion.
    expect(hookSource).toMatch(/return\s*\{[^}]*isMounted[^}]*\}/);
  });

  it('sets isMounted to true inside a layout effect (post-hydration)', () => {
    // isMounted flipping to true must happen inside an effect so SSR renders
    // with the initial false value and the transition only kicks in client-side.
    const layoutEffectBlock = hookSource.match(
      /useIsomorphicLayoutEffect\(\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[\]\)/,
    );
    expect(layoutEffectBlock).not.toBeNull();
    expect(layoutEffectBlock?.[0] ?? '').toContain('setIsMounted(true)');
  });

  it('still exposes prefersReducedMotion and alreadyVisible for consumers that optimize above-the-fold content', () => {
    expect(hookSource).toContain('prefersReducedMotion');
    expect(hookSource).toContain('alreadyVisible');
  });
});
