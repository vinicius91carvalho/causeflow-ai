/**
 * Smoke test for RemediationDetail.
 *
 * Source-string regression — guards the action-bar button styling against
 * accidental drift back to the legacy solid-filled palette. The CauseFlow
 * convention (mirrored from <IncidentFeedback>'s Confirm/Reject RCA) is
 * outlined + tinted, never `bg-green-600 text-white` / `bg-red-600 text-white`
 * for the trigger buttons.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, 'remediation-detail.tsx'), 'utf8');

describe('remediation-detail.tsx — CauseFlow button palette regression', () => {
  it('approve trigger uses outlined success token tint, not solid bg-green-600 / bg-success', () => {
    // Outlined + tinted via design tokens (migrated from green-300/50/700 literals).
    expect(SOURCE).toMatch(/border-success\/40 bg-success\/10.*?text-success/s);
    // Must NOT regress to the legacy solid-filled style (either Tailwind palette or solid token).
    expect(SOURCE).not.toMatch(
      /onClick=\{\(\) => performAction\('approve'\)\}[\s\S]{0,400}(?:bg-green-600|bg-success(?!\/))/,
    );
  });

  it('reject trigger uses outlined destructive token tint, not solid bg-red-600 / bg-destructive', () => {
    expect(SOURCE).toMatch(/border-destructive\/40 bg-destructive\/10.*?text-destructive/s);
    expect(SOURCE).not.toMatch(
      /setShowRejectModal\(true\)[\s\S]{0,400}(?:bg-red-600|bg-destructive(?!\/))/,
    );
  });

  it('still polls only when status is executing (not for proposed/approved)', () => {
    expect(SOURCE).toMatch(/POLLING_STATUS = new Set/);
    expect(SOURCE).toMatch(/'executing'/);
  });
});
