/**
 * Source-guard contract tests for FixOptions.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./fix-options.tsx', import.meta.url)), 'utf-8');

describe('FixOptions component contract', () => {
  it('exports FixOptions function', () => {
    expect(source).toMatch(/export function FixOptions/);
  });

  it('renders three fix-option cards via a grid', () => {
    expect(source).toMatch(/grid/);
    expect(source).toMatch(/sm:grid-cols-3/);
  });

  it('accepts options[] with title + tradeoff + optional badge', () => {
    expect(source).toMatch(/title/);
    expect(source).toMatch(/tradeoff/);
    expect(source).toMatch(/badge/);
  });

  it('uses design tokens (bg-card, border-border)', () => {
    expect(source).toMatch(/bg-card/);
    expect(source).toMatch(/border-border/);
  });

  it('has no call-to-action elements — CauseFlow surfaces, humans decide', () => {
    expect(source).not.toMatch(/<button|<a\s/i);
  });
});
