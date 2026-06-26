/**
 * Source-guard contract tests for AffectedRoutesStrip.
 * Validates the horizontal pill row showing affected routes.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./affected-routes-strip.tsx', import.meta.url)),
  'utf-8',
);

describe('AffectedRoutesStrip component contract', () => {
  it('exports AffectedRoutesStrip function', () => {
    expect(source).toMatch(/AffectedRoutesStrip/);
  });

  it('renders route pills in a horizontal strip', () => {
    expect(source).toMatch(/flex/);
    expect(source).toMatch(/rounded/);
  });

  it('shows /pricing as an affected route', () => {
    expect(source).toMatch(/\/pricing/);
  });

  it('uses red accent for the failure state', () => {
    expect(source).toMatch(/red-500|red-600/);
  });

  it('shows systemic routes (/, /features, /blog)', () => {
    expect(source).toMatch(/\/features|\/blog/);
  });
});
