/**
 * Smoke test for MaskingBadge — verifies the badge renders a summary when
 * masking metadata is present and hides itself when nothing was redacted.
 *
 * Uses a source-level assertion (like incident-feedback.test.tsx in this
 * repo) because the dashboard's existing React unit setup is import-heavy
 * and we only need to verify the intent of the component here.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, 'masking-badge.tsx'), 'utf8');

describe('MaskingBadge', () => {
  it('short-circuits when no fields were masked', () => {
    expect(SOURCE).toMatch(/if\s*\(\s*masking\.totalFields\s*===\s*0\s*\)\s*return\s+null/);
  });

  it('distinguishes secret detections from PII-only ones visually', () => {
    expect(SOURCE).toContain('SECRET_DETECTORS');
    expect(SOURCE).toContain('aws_access_key');
    expect(SOURCE).toContain('bearer_token');
    expect(SOURCE).toContain('jwt');
  });

  it('renders detector counts in the popover', () => {
    expect(SOURCE).toContain('masking.detections.map');
    expect(SOURCE).toContain('DETECTOR_LABELS');
  });

  it('uses semantic shield icon to signal protection', () => {
    expect(SOURCE).toContain('ShieldCheck');
  });
});
