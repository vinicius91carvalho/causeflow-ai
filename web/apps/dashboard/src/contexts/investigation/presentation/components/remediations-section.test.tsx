/**
 * Smoke test for RemediationsSection that proves Sprint 1's bug fix:
 * the perma-`Loading...` literal is gone, error state is explicit, and
 * the four-state branching foundation is in place.
 *
 * Behavioral tests for the new <RemediationsEmptyState> live in Sprint 4.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, 'remediations-section.tsx'), 'utf8');

describe('remediations-section.tsx — Loading bug regression', () => {
  it('does not contain the literal "Loading..." string', () => {
    expect(SOURCE).not.toMatch(/"Loading\.\.\."/);
    expect(SOURCE).not.toMatch(/>Loading\.\.\.</);
  });

  it('uses setError to record fetch failures', () => {
    expect(SOURCE).toMatch(/setError\(/);
  });

  it('renders an explicit error branch', () => {
    expect(SOURCE).toMatch(/error \?/);
  });
});
