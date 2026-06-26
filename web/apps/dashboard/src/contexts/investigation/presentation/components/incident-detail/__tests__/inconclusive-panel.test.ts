/**
 * Source-level guard for IncidentInconclusivePanel.
 * Verifies the component uses semantic DS tokens (warning, not hardcoded amber)
 * and exports the expected function name.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('../inconclusive-panel.tsx', import.meta.url)),
  'utf-8',
);

describe('IncidentInconclusivePanel source guard', () => {
  it('exports IncidentInconclusivePanel', () => {
    expect(source).toMatch(/export function IncidentInconclusivePanel/);
  });

  it('uses semantic warning tokens, not hardcoded amber', () => {
    expect(source).not.toMatch(/\bamber-\d{2,3}\b/);
    expect(source).toMatch(/text-warning|bg-warning|border-warning/);
  });

  it('reads from the dashboard.incidents.detail.inconclusive i18n namespace', () => {
    expect(source).toMatch(/useTranslations\(['"]dashboard\.incidents\.detail\.inconclusive['"]\)/);
    expect(source).toMatch(/t\(['"]headline['"]\)/);
  });

  it('contains next steps content', () => {
    expect(source).toMatch(/nextStep/);
  });

  it('contains a reason/resolution display', () => {
    expect(source).toMatch(/resolution/);
  });
});
