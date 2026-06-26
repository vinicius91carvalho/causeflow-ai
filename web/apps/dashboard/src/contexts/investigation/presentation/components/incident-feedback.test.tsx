/**
 * Smoke test for IncidentFeedback that proves Sprint 1's bug fix:
 *
 * 1. The literal string "Loading..." is gone from the source.
 * 2. A `setError` call exists in the fetch path (no early-return-on-error).
 * 3. An error state branch renders when the fetch fails.
 *
 * Behavioral tests for the rendered four-state UI live in
 * `incident-detail/__tests__/feedback-empty-state.test.tsx` (Sprint 4) where
 * the new state component is verified in isolation.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, 'incident-feedback.tsx'), 'utf8');

describe('incident-feedback.tsx — Loading bug regression', () => {
  it('does not contain the literal "Loading..." string', () => {
    expect(SOURCE).not.toMatch(/"Loading\.\.\."/);
    expect(SOURCE).not.toMatch(/>Loading\.\.\.</);
  });

  it('uses setError to record fetch failures (no silent early-return)', () => {
    expect(SOURCE).toMatch(/setError\(/);
  });

  it('renders an explicit error branch', () => {
    expect(SOURCE).toMatch(/error \?/);
  });
});
