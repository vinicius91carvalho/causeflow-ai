/**
 * Source-level tests for home-page.tsx skeleton fallbacks.
 *
 * Regression: dynamic-import skeletons previously rendered as empty divs with
 * no background, producing invisible placeholders during hydration. For bots,
 * slow-JS users, and pre-hydration Playwright captures, the page read as
 * "hero + blank space + footer".
 *
 * Fix: every dynamic-import skeleton must ship a visible background
 * (animate-pulse + muted/card token) so the space is never read as absent
 * content.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./home-page.tsx', import.meta.url)), 'utf-8');

describe('home-page.tsx dynamic-import skeletons', () => {
  it('CarouselSkeleton has a visible background', () => {
    const block = source.match(/const CarouselSkeleton[\s\S]*?\);/);
    expect(block).not.toBeNull();
    expect(block?.[0] ?? '').toMatch(/bg-(card|muted)/);
    expect(block?.[0] ?? '').toMatch(/animate-pulse/);
  });

  it('wires Docs CTA to GitHub Pages docs URL', () => {
    expect(source).toMatch(/docsCta=\{\{[\s\S]*SITE\.docsUrl/);
    expect(source).toMatch(/SITE\.docsUrl/);
  });
});
