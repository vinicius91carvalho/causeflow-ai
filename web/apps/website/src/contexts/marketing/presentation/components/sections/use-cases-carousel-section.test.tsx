/**
 * Source-level contract tests for UseCasesCarouselSection.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./use-cases-carousel-section.tsx', import.meta.url)),
  'utf-8',
);

describe('UseCasesCarouselSection source contract', () => {
  it('renders as a #use-cases section with cream bg', () => {
    expect(source).toMatch(/id="use-cases"/);
    expect(source).toMatch(/bg-background/);
  });

  it('renders cards via map', () => {
    expect(source).toMatch(/cards\.map/);
  });

  it('uses bg-card surface for each card', () => {
    expect(source).toMatch(/bg-card/);
  });

  it('exposes prev/next carousel controls', () => {
    expect(source).toMatch(/prevLabel/);
    expect(source).toMatch(/nextLabel/);
  });

  it('uses mono finding block', () => {
    expect(source).toMatch(/font-mono/);
  });
});
