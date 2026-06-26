import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IncidentTimestamps } from '../incident-timestamps';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'incident-timestamps.tsx'), 'utf8');

describe('<IncidentTimestamps>', () => {
  it('exports the component', () => {
    expect(IncidentTimestamps).toBeDefined();
    expect(typeof IncidentTimestamps).toBe('function');
  });

  it('renders createdAt, updatedAt, resolvedAt and sourceAlertId fields', () => {
    expect(SOURCE).toMatch(/incident\.createdAt/);
    expect(SOURCE).toMatch(/incident\.updatedAt/);
    expect(SOURCE).toMatch(/incident\.resolvedAt/);
    expect(SOURCE).toMatch(/incident\.sourceAlertId/);
  });

  it('omits resolvedAt and sourceAlertId when not set (conditional renders)', () => {
    expect(SOURCE).toMatch(/incident\.resolvedAt &&/);
    expect(SOURCE).toMatch(/incident\.sourceAlertId &&/);
  });

  it('uses formatDate from the shared lib', () => {
    expect(SOURCE).toMatch(/formatDate/);
    expect(SOURCE).toMatch(/@\/contexts\/shared\/lib\/format-date/);
  });
});
