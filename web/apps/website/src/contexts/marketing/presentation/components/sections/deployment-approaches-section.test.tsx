/**
 * Source-level contract tests for DeploymentApproachesSection.
 *
 * Guards: no "Fale Conosco"/talkWithUs button remains after removal.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./deployment-approaches-section.tsx', import.meta.url)),
  'utf-8',
);

describe('DeploymentApproachesSection source contract', () => {
  it('does not render talkWithUs / Fale Conosco CTA anywhere', () => {
    expect(source).not.toMatch(/talkWithUs/);
  });
});
