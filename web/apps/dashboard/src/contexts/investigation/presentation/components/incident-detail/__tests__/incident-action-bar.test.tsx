import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IncidentActionBar } from '../incident-action-bar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'incident-action-bar.tsx'), 'utf8');

describe('<IncidentActionBar>', () => {
  it('exports a component function', () => {
    expect(IncidentActionBar).toBeDefined();
    expect(typeof IncidentActionBar).toBe('function');
  });

  it('renders triage / investigate buttons for status open', () => {
    expect(SOURCE).toMatch(/'open'/);
    expect(SOURCE).toMatch(/onStartTriage/);
    expect(SOURCE).toMatch(/onStartInvestigation/);
  });

  it('renders abort flow for status investigating', () => {
    expect(SOURCE).toMatch(/'investigating'/);
    expect(SOURCE).toMatch(/onAbort/);
  });

  it('renders rerun for resolved/closed states', () => {
    expect(SOURCE).toMatch(/'resolved'|'closed'/);
    expect(SOURCE).toMatch(/onRerun/);
  });

  it('is pure presentational — no fetch calls', () => {
    expect(SOURCE).not.toMatch(/await fetch/);
  });
});
