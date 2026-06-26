/**
 * Source-guard tests for BusinessImpactCard.
 * Validates: big hero number, caption, stat structure.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./business-impact-card.tsx', import.meta.url)),
  'utf-8',
);

describe('BusinessImpactCard component contract', () => {
  it('exports BusinessImpactCard as named export', () => {
    expect(source).toMatch(/export function BusinessImpactCard/);
  });

  it('accepts a stat (hero number) prop', () => {
    expect(source).toMatch(/stat|heroNumber|value/i);
  });

  it('accepts a caption prop', () => {
    expect(source).toMatch(/caption/);
  });

  it('accepts a label or title prop', () => {
    expect(source).toMatch(/label|title/);
  });

  it('renders the stat prominently with large text', () => {
    expect(source).toMatch(/text-[0-9]+xl|text-\[|clamp|font-bold|font-semibold/);
  });

  it('accepts i18n interface', () => {
    expect(source).toMatch(/interface\s+Business|labels|props/i);
  });
});
