import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IncidentHeader } from '../incident-header';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'incident-header.tsx'), 'utf8');

describe('<IncidentHeader>', () => {
  it('exports the component', () => {
    expect(IncidentHeader).toBeDefined();
    expect(typeof IncidentHeader).toBe('function');
  });

  it('renders the incident timestamps inside the details collapse', () => {
    expect(SOURCE).toMatch(/formatDate\(incident\.createdAt\)/);
    expect(SOURCE).toMatch(/formatDate\(incident\.updatedAt\)/);
  });

  it('gates the details section behind showDetails state', () => {
    expect(SOURCE).toMatch(/useState\(false\)/);
    expect(SOURCE).toMatch(/showDetails\s*\?\s*'grid-rows-\[1fr\]'\s*:\s*'grid-rows-\[0fr\]'/);
  });
});
