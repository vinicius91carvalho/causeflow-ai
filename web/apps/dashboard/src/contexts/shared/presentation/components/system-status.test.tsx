import { describe, expect, it } from 'vitest';

/**
 * Tests for SystemStatus component.
 *
 * Dashboard vitest project runs in `node` environment (not jsdom), so we do
 * not render the component here. Instead we verify the static contract that
 * the component depends on:
 *
 *   1. The file imports and uses `/api/health` (lightweight liveness),
 *      NOT `/api/health/detailed`.
 *   2. The file exports the `SystemStatus` component.
 *
 * Runtime rendering + interaction coverage lives in Sprint 5's Playwright E2E.
 * INVARIANTS.md also enforces the URL invariant at the hook level.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('./system-status.tsx', import.meta.url));
const SOURCE = readFileSync(HERE, 'utf8');

describe('SystemStatus', () => {
  it('exports the SystemStatus component', async () => {
    const mod = await import('./system-status');
    expect(mod.SystemStatus).toBeDefined();
    expect(typeof mod.SystemStatus).toBe('function');
  });

  it("fetches '/api/health' (lightweight liveness)", () => {
    expect(SOURCE).toContain("'/api/health'");
  });

  it("does NOT fetch '/api/health/detailed'", () => {
    expect(SOURCE).not.toContain('/api/health/detailed');
  });

  it('uses HealthStatus type (not HealthDetailedStatus)', () => {
    expect(SOURCE).toContain('HealthStatus');
    expect(SOURCE).not.toContain('HealthDetailedStatus');
  });
});
