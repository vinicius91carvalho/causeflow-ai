import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./cta-stop-hunting-section.tsx', import.meta.url)),
  'utf-8',
);

describe('CtaStopHuntingSection', () => {
  it('renders optional docsCta as an external GitHub Pages link', () => {
    expect(source).toMatch(/docsCta\?/);
    expect(source).toMatch(/docsCta\.href/);
    expect(source).toMatch(/target="_blank"/);
  });
});
