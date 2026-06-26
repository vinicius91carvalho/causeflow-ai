/**
 * Source-level tests for InvestigationDashboardPreview.
 *
 * Regression guards for the motion audit findings (MOT-01):
 * - Phase timers must NOT start on mount. They must start only when the
 *   component enters the viewport — otherwise users who scroll past quickly
 *   see a completed, static animation instead of the live sequence.
 * - prefers-reduced-motion must jump directly to the final phase so the
 *   content is fully legible with no animation.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./investigation-dashboard-preview.tsx', import.meta.url)),
  'utf-8',
);

describe('InvestigationDashboardPreview source contract', () => {
  it('uses an IntersectionObserver to gate phase timers', () => {
    expect(source).toMatch(/new IntersectionObserver/);
  });

  it('tracks viewport entry with an isInView state', () => {
    expect(source).toMatch(/\[isInView,\s*setIsInView\]\s*=\s*useState\(false\)/);
  });

  it('phase timer effect depends on isInView, not an empty array', () => {
    expect(source).toMatch(/setTimeout\(\(\)\s*=>\s*setPhase\(1\),\s*300\)/);
    expect(source).toMatch(/if\s*\(!isInView\)\s*return/);
    expect(source).toMatch(/\},\s*\[isInView\]\);/);
  });

  it('respects prefers-reduced-motion by jumping to the final phase', () => {
    expect(source).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(source).toMatch(/setPhase\(5\)/);
  });

  it('attaches a ref to the root container for the observer', () => {
    expect(source).toMatch(/rootRef\s*=\s*useRef<HTMLDivElement>\(null\)/);
    expect(source).toMatch(/ref=\{rootRef\}/);
  });
});
