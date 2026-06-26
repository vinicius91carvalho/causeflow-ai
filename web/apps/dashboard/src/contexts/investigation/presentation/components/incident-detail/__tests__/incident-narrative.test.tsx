import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IncidentNarrative } from '../incident-narrative';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'incident-narrative.tsx'), 'utf8');

describe('<IncidentNarrative>', () => {
  it('exports the component', () => {
    expect(IncidentNarrative).toBeDefined();
    expect(typeof IncidentNarrative).toBe('function');
  });

  it('renders Description, Root Cause, Resolution sections', () => {
    expect(SOURCE).toMatch(/incident\.description/);
    expect(SOURCE).toMatch(/incident\.rootCause/);
    expect(SOURCE).toMatch(/incident\.resolution/);
  });

  it('does not expose internal agent names to the user', () => {
    expect(SOURCE).not.toMatch(/assignedAgents/);
  });

  it('omits sections when their data is missing (conditional renders)', () => {
    expect(SOURCE).toMatch(/incident\.description &&/);
    expect(SOURCE).toMatch(/incident\.rootCause &&/);
    expect(SOURCE).toMatch(/incident\.resolution &&/);
  });

  it('does not render Timestamps (moved to <IncidentTimestamps> in right column)', () => {
    expect(SOURCE).not.toMatch(/incident\.createdAt/);
    expect(SOURCE).not.toMatch(/incident\.updatedAt/);
    expect(SOURCE).not.toMatch(/t\('timestamps'\)/);
    expect(SOURCE).not.toMatch(/formatDate/);
  });
});
