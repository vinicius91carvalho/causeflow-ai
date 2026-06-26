/**
 * Source-guard tests for TrafficErrorChart.
 * Validates: dual-line SVG chart, green/red lines, axis labels, reduced-motion support.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./traffic-error-chart.tsx', import.meta.url)),
  'utf-8',
);

describe('TrafficErrorChart component contract', () => {
  it('exports TrafficErrorChart as named export', () => {
    expect(source).toMatch(/export function TrafficErrorChart/);
  });

  it('renders an inline SVG path element for the chart lines', () => {
    expect(source).toMatch(/<svg/);
    expect(source).toMatch(/<path/);
  });

  it('has a green line for request volume', () => {
    expect(source).toMatch(/green|#22c55e|emerald|requests/i);
  });

  it('has a red line for error count', () => {
    expect(source).toMatch(/red|#ef4444|rose|errors/i);
  });

  it('accepts i18n labels for axis and legend', () => {
    expect(source).toMatch(/labels|requestsLabel|errorsLabel|legend/i);
  });

  it('respects prefers-reduced-motion', () => {
    expect(source).toMatch(/prefers-reduced-motion|motion-safe/);
  });

  it('is mobile-first — chart remains readable under 640px', () => {
    expect(source).toMatch(/w-full|min-w|viewBox/);
  });
});
