/**
 * Source-guard contract tests for ColdStartMathSvg.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./cold-start-math-svg.tsx', import.meta.url)),
  'utf-8',
);

describe('ColdStartMathSvg component contract', () => {
  it('exports ColdStartMathSvg function', () => {
    expect(source).toMatch(/export function ColdStartMathSvg/);
  });

  it('uses inline SVG (no external asset files)', () => {
    expect(source).toMatch(/<svg/);
  });

  it('accepts lane count + timing as props — no hardcoded numeric labels', () => {
    expect(source).toMatch(/initDurationMs/);
    expect(source).toMatch(/fetchDurationMs/);
    expect(source).toMatch(/totalBudgetMs/);
    expect(source).toMatch(/laneCount/);
  });

  it('renders caption + wall label from i18n props', () => {
    expect(source).toMatch(/caption/);
    expect(source).toMatch(/wallLabel/);
  });

  it('has role="img" + aria-label for screen readers', () => {
    expect(source).toMatch(/role="img"/);
    expect(source).toMatch(/aria-label/);
  });
});
