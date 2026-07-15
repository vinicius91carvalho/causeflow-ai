import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./cta-stop-hunting-section.tsx', import.meta.url)),
  'utf-8',
);

describe('CtaStopHuntingSection', () => {
  it('renders external secondary CTA for GitHub (AC-079)', () => {
    expect(source).toMatch(/secondaryCta\.external/);
    expect(source).toMatch(/target="_blank"/);
  });
});
