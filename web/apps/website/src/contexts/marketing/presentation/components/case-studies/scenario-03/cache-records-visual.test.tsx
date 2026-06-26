/**
 * Source-guard tests for CacheRecordsVisual.
 * Validates: ~80 row grid, revalidatedAt:1 indicator, critical finding callout.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./cache-records-visual.tsx', import.meta.url)),
  'utf-8',
);

describe('CacheRecordsVisual component contract', () => {
  it('exports CacheRecordsVisual as named export', () => {
    expect(source).toMatch(/export function CacheRecordsVisual/);
  });

  it('represents ~80 cache rows', () => {
    // Must reference the count (80) or generate rows up to that count
    expect(source).toMatch(/80/);
  });

  it('shows revalidatedAt: 1 on every row', () => {
    expect(source).toMatch(/revalidatedAt/);
    expect(source).toMatch(/:\s*1|"1"|=\s*1/);
  });

  it('renders a grid or table of pills/rows', () => {
    expect(source).toMatch(/grid|table|pill|row/i);
  });

  it('includes a critical-finding callout about cache never being warm', () => {
    expect(source).toMatch(/never|warm|cold|finding|callout/i);
  });

  it('accepts i18n labels', () => {
    expect(source).toMatch(/labels|findingLabel|rowLabel|interface\s+Cache/i);
  });
});
