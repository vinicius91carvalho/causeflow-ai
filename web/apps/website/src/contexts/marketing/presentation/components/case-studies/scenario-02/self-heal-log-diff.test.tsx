/**
 * Source-guard contract tests for SelfHealLogDiff.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./self-heal-log-diff.tsx', import.meta.url)),
  'utf-8',
);

describe('SelfHealLogDiff component contract', () => {
  it('exports SelfHealLogDiff function', () => {
    expect(source).toMatch(/export function SelfHealLogDiff/);
  });

  it('uses the shared EvidenceCard primitive for both sides', () => {
    expect(source).toMatch(/EvidenceCard/);
  });

  it('accepts before/after titles + lines as props (i18n-resolved)', () => {
    expect(source).toMatch(/beforeTitle/);
    expect(source).toMatch(/afterTitle/);
    expect(source).toMatch(/beforeLines/);
    expect(source).toMatch(/afterLines/);
  });

  it('lays out before and after side-by-side with a responsive grid', () => {
    expect(source).toMatch(/grid/);
    expect(source).toMatch(/sm:grid-cols-2/);
  });

  it('tones the "before" card as error to signal incident state', () => {
    expect(source).toMatch(/tone="error"/);
  });
});
