/**
 * Source-level contract tests for HeroMainHeader.
 *
 * Guards the template-faithful layout:
 *  - centered single-column composition (not two-column split)
 *  - audience toggle swaps h1a/h1b/lead between eng/ops content
 *  - radial-gradient + dotted-grid background
 *  - h1 uses the display font stack (Space Grotesk via --font-space-grotesk)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./hero-main-header.tsx', import.meta.url)),
  'utf-8',
);

describe('HeroMainHeader source contract', () => {
  it('declares both eng and ops label sets', () => {
    expect(source).toMatch(/engH1a/);
    expect(source).toMatch(/engH1b/);
    expect(source).toMatch(/engLead/);
    expect(source).toMatch(/opsH1a/);
    expect(source).toMatch(/opsH1b/);
    expect(source).toMatch(/opsLead/);
  });

  it('swaps headline text via the audience state', () => {
    expect(source).toMatch(/audience\s*===\s*'eng'/);
    expect(source).toMatch(/labels\.(engH1a|opsH1a)/);
  });

  it('renders a single centered column (no two-column grid)', () => {
    expect(source).not.toMatch(/lg:grid-cols-2/);
    expect(source).toMatch(/text-center/);
  });

  it('paints a radial-gradient hero background with teal + violet', () => {
    expect(source).toMatch(/radial-gradient/);
    expect(source).toMatch(/--accent/);
    expect(source).toMatch(/--violet/);
  });

  it('uses the display font on the hero headline', () => {
    expect(source).toMatch(/font-display/);
  });

  it('renders no hero CTAs (platform is self-service)', () => {
    // User directive: remove "Agendar demo" / "Ver em ação" — no demo booking exists.
    expect(source).not.toMatch(/labels\.cta1/);
    expect(source).not.toMatch(/labels\.cta2/);
    expect(source).not.toMatch(/ctaPrimaryHref/);
    expect(source).not.toMatch(/ctaSecondaryHref/);
  });

  it('places the product visual below the copy', () => {
    expect(source).toMatch(/visual/);
    expect(source.indexOf('{labels.audEng}')).toBeLessThan(source.indexOf('{visual}'));
  });

  it('surfaces open-source messaging in the hero header', () => {
    expect(source).toMatch(/labels\.eyebrow/);
    expect(source).toMatch(/labels\.trust2/);
  });
});
