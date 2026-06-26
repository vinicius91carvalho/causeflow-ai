/**
 * Source-guard contract tests for BudgetBar.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./budget-bar.tsx', import.meta.url)), 'utf-8');

describe('BudgetBar component contract', () => {
  it('exports BudgetBar function', () => {
    expect(source).toMatch(/export function BudgetBar/);
  });

  it('accepts totalMs, coldStartMs, and ticks as props', () => {
    expect(source).toMatch(/totalMs/);
    expect(source).toMatch(/coldStartMs/);
    expect(source).toMatch(/ticks/);
  });

  it('exposes label props pulled from i18n by the page', () => {
    expect(source).toMatch(/coldStartLabel/);
    expect(source).toMatch(/remainingLabel/);
    expect(source).toMatch(/budgetLabel/);
  });

  it('uses design tokens (no raw HSL values)', () => {
    expect(source).toMatch(/bg-muted|bg-amber|bg-red/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('respects prefers-reduced-motion via motion-safe utilities', () => {
    expect(source).toMatch(/motion-safe|prefers-reduced-motion/);
  });

  it('marks decorative elements aria-hidden', () => {
    expect(source).toMatch(/aria-hidden/);
  });
});
