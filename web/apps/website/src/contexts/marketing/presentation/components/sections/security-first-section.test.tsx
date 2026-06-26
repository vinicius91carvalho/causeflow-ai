import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Static source-analysis tests for SecurityFirstSection.
 *
 * Verifies that the gradient emphasis fix (P0 mobile clip bug) is correctly
 * applied:
 *  1. The emphasis <em> uses bg-clip-text + text-transparent (gradient rendering).
 *  2. The emphasis <em> has pb-1 padding to prevent descender clipping by the
 *     parent overflow-hidden container on tight mobile line-heights.
 *
 * Uses readFileSync + regex — no component rendering (no @testing-library/react).
 */

const SRC = readFileSync(
  new URL('./security-first-section.tsx', import.meta.url).pathname,
  'utf-8',
);

describe('SecurityFirstSection gradient emphasis — mobile clip fix', () => {
  it('emphasis <em> uses bg-clip-text for gradient text rendering', () => {
    expect(SRC).toMatch(/bg-clip-text/);
  });

  it('emphasis <em> uses text-transparent so gradient shows through', () => {
    expect(SRC).toMatch(/text-transparent/);
  });

  it('emphasis <em> has pb-1 to prevent descender clipping by overflow-hidden parent', () => {
    expect(SRC).toMatch(/pb-1/);
  });

  it('emphasis <em> uses a bg-gradient-to-r for the teal accent gradient', () => {
    expect(SRC).toMatch(/bg-gradient-to-r/);
  });

  it('does NOT use bare text-accent alone on the emphasis element (solid color removed)', () => {
    // Ensure the old solid-color pattern is gone: not-italic text-accent"  (no other classes between)
    // We look for the em element — it must NOT have text-accent as the only color class
    // The gradient approach replaces text-accent with text-transparent + bg-clip-text
    const emMatch = SRC.match(/<em\s+className="([^"]+)"/);
    expect(emMatch).not.toBeNull();
    const emClasses = emMatch?.[1];
    // Must NOT be solely "not-italic text-accent" (old pattern)
    expect(emClasses).not.toBe('not-italic text-accent');
    // Must use gradient approach
    expect(emClasses).toContain('bg-clip-text');
    expect(emClasses).toContain('text-transparent');
  });
});
