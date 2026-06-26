/**
 * Tests for incidents-list.tsx
 *
 * Covers:
 *   Filter UI — design-system Select components (no native <select>)
 *   Pagination — limit query param is '10' (first page)
 *   Component contract — IncidentsList export
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, 'incidents-list.tsx'), 'utf8');

describe('<IncidentsList> — filter UI', () => {
  it('uses design-system SelectTrigger instead of native select', () => {
    expect(SOURCE).toMatch(/SelectTrigger/);
  });

  it('uses onValueChange instead of onChange for filter updates', () => {
    expect(SOURCE).toMatch(/onValueChange/);
    expect(SOURCE).not.toMatch(/onChange.*setStatusFilter/);
  });

  it('uses SelectItem for filter options', () => {
    expect(SOURCE).toMatch(/SelectItem/);
  });

  it('does not use native <select> elements', () => {
    expect(SOURCE).not.toMatch(/<select[\s>]/);
  });
});

describe('<IncidentsList> — pagination', () => {
  it('fetches with limit 10 on first page', () => {
    expect(SOURCE).toMatch(/limit.*['"]10['"]/);
  });

  it('does not use limit 20 for first page', () => {
    expect(SOURCE).not.toMatch(/limit.*['"]20['"]/);
  });

  it('supports load-more with cursor', () => {
    expect(SOURCE).toMatch(/cursorRef/);
    expect(SOURCE).toMatch(/hasMore/);
  });
});

describe('<IncidentsList> — component contract', () => {
  it('exports the IncidentsList component as a named export', () => {
    expect(SOURCE).toMatch(/export function IncidentsList/);
  });
});
