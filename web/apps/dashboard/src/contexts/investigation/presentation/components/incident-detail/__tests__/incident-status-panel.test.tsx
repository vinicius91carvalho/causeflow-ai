import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IncidentStatusPanel } from '../incident-status-panel';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'incident-status-panel.tsx'), 'utf8');

describe('<IncidentStatusPanel>', () => {
  it('exports the component', () => {
    expect(IncidentStatusPanel).toBeDefined();
    expect(typeof IncidentStatusPanel).toBe('function');
  });

  it('does not use sticky positioning (single-column layout)', () => {
    expect(SOURCE).not.toMatch(/sticky/);
  });

  it('does not reference SSE stream status (removed)', () => {
    expect(SOURCE).not.toMatch(/streamStatus/);
  });

  it('accepts an actionBar prop and renders it inline', () => {
    expect(SOURCE).toMatch(/actionBar/);
  });

  it('renders the incident title', () => {
    expect(SOURCE).toMatch(/incident\.title/);
  });
});
