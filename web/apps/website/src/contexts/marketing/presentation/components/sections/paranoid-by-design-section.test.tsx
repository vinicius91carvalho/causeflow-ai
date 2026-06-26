/**
 * Source-level contract tests for ParanoidByDesignSection.
 *
 * Guards: typography, card rendering, icon union, future-feature badge,
 * grouped layout, and white-surface cards on the grey section backdrop.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./paranoid-by-design-section.tsx', import.meta.url)),
  'utf-8',
);

describe('ParanoidByDesignSection source contract', () => {
  it('uses display font + mono eyebrow typography', () => {
    expect(source).toMatch(/font-display/);
    expect(source).toMatch(/font-mono/);
  });

  it('renders cards via map', () => {
    expect(source).toMatch(/cards\.map/);
  });

  it('groups cards under a category title', () => {
    expect(source).toMatch(/groups\.map/);
    expect(source).toMatch(/group\.cards\.map/);
  });

  it('narrows icon kind to the supported variants', () => {
    expect(source).toMatch(
      /'readonly' \| 'scope' \| 'approve' \| 'tenant' \| 'no-train' \| 'audit'/,
    );
  });

  it('renders a future-feature badge when card.future is true', () => {
    expect(source).toMatch(/card\.future/);
    expect(source).toMatch(/futureLabel/);
  });

  it('uses bg-card surface for each card', () => {
    expect(source).toMatch(/bg-card/);
  });
});
