/**
 * Source-introspection test for <DisconnectedBanner>.
 *
 * The dashboard test convention is to read source as a string and assert
 * structural invariants — pure-function tests where applicable, and
 * source greps for component shape (we don't have React Testing Library
 * configured in the dashboard package). Smoke imports prove the module
 * loads cleanly under the project's TS pipeline.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DisconnectedBanner } from '../disconnected-banner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'disconnected-banner.tsx'), 'utf8');

describe('<DisconnectedBanner>', () => {
  it('exports a component function', () => {
    expect(DisconnectedBanner).toBeDefined();
    expect(typeof DisconnectedBanner).toBe('function');
  });

  it('returns null when status is connected', () => {
    expect(SOURCE).toMatch(/status === 'connected'/);
    expect(SOURCE).toMatch(/return null/);
  });

  it('renders a Reconnect button on disconnected/error states', () => {
    expect(SOURCE).toMatch(/onReconnect/);
    expect(SOURCE).toMatch(/t\('reconnect'\)/);
  });

  it('renders a quiet connecting indicator while connecting', () => {
    expect(SOURCE).toMatch(/t\('connecting'\)/);
    expect(SOURCE).toMatch(/Loader2/);
  });

  it('uses the dashboard.incidents.detail.stream namespace', () => {
    expect(SOURCE).toMatch(/dashboard\.incidents\.detail\.stream/);
  });

  it('uses an alert role for failure states', () => {
    expect(SOURCE).toMatch(/role="alert"/);
  });
});
