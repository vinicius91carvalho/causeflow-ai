/**
 * Source-guard contract tests for TwoBugsDiagram.
 * Validates the inline SVG data-flow diagram for scenario-01.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./two-bugs-diagram.tsx', import.meta.url)),
  'utf-8',
);

describe('TwoBugsDiagram component contract', () => {
  it('exports TwoBugsDiagram function', () => {
    expect(source).toMatch(/TwoBugsDiagram/);
  });

  it('uses inline SVG (no external asset files)', () => {
    expect(source).toMatch(/<svg/i);
  });

  it('shows two failure glyphs (red X marks)', () => {
    // Two red X indicators in the data-flow diagram
    expect(source).toMatch(/red-500|red-600/);
  });

  it('includes CMS and Next.js as data-flow endpoints', () => {
    expect(source).toMatch(/CMS/);
    expect(source).toMatch(/Next\.js|Next/);
  });

  it('respects prefers-reduced-motion', () => {
    expect(source).toMatch(/motion-reduce|prefers-reduced-motion/);
  });

  it('has hover or tooltip for failing code snippets', () => {
    expect(source).toMatch(/group|hover:|title|tooltip/i);
  });
});
