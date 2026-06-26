/**
 * Regression test for the `Cannot read properties of undefined (reading 'filter')`
 * crash on /dashboard/relay. The Core API returns `{ connected, resources }` but
 * the component expected `{ connected, agents, relayUrl }`. The fix normalizes
 * missing `agents` to `[]` before storing in state so the filter() call is safe.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, './relay-status.tsx'), 'utf-8');

describe('RelayStatus — defensive shape normalization', () => {
  it('normalizes missing `agents` to [] before setData', () => {
    expect(source).toContain('Array.isArray(raw.agents) ? raw.agents : []');
  });

  it('coerces `connected` to a boolean', () => {
    expect(source).toContain('Boolean(raw.connected)');
  });
});
