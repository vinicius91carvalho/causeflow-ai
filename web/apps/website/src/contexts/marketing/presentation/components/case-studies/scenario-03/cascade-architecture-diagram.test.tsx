/**
 * Source-guard tests for CascadeArchitectureDiagram.
 * Validates: SVG structure, node labels, reduced-motion support, mobile-first layout.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./cascade-architecture-diagram.tsx', import.meta.url)),
  'utf-8',
);

describe('CascadeArchitectureDiagram component contract', () => {
  it('exports CascadeArchitectureDiagram as named export', () => {
    expect(source).toMatch(/export function CascadeArchitectureDiagram/);
  });

  it('renders an inline SVG element', () => {
    expect(source).toMatch(/<svg/);
  });

  it('includes all four architecture nodes', () => {
    expect(source).toMatch(/Visitors/);
    expect(source).toMatch(/CloudFront/);
    expect(source).toMatch(/Lambda/);
    expect(source).toMatch(/CMS/);
  });

  it('marks the CMS node as the hot path with a distinct style', () => {
    // CMS node should have a red or error-tone visual indicator
    expect(source).toMatch(/red|error|incident/i);
  });

  it('respects prefers-reduced-motion by disabling pulse animation', () => {
    expect(source).toMatch(/prefers-reduced-motion|motion-safe|@media.*prefers-reduced-motion/);
  });

  it('uses a mobile-first vertical flow under 640px', () => {
    // Either flex-col or sm: prefix or explicit breakpoint comment
    expect(source).toMatch(/flex-col|sm:|640/);
  });

  it('accepts i18n prop for node labels', () => {
    expect(source).toMatch(/labels|props\s*\{|interface\s+Cascade/);
  });
});
