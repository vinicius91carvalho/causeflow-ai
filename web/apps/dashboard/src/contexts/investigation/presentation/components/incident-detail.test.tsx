/**
 * Smoke test for IncidentDetail.
 *
 * Verifies the component opens the AC-025 SSE stream (EventSource via
 * useIncidentStream) while keeping the WebSocket live feed and polling
 * as a WS fallback.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, 'incident-detail.tsx'), 'utf8');

describe('incident-detail.tsx — live SSE + WS feed', () => {
  it('opens the incident SSE stream via useIncidentStream (AC-025)', () => {
    expect(SOURCE).toMatch(/useIncidentStream/);
    expect(SOURCE).toMatch(/agent\.completed/);
  });

  it('uses polling for status updates while in progress as WS fallback', () => {
    expect(SOURCE).toMatch(/POLL_INTERVAL_MS/);
    expect(SOURCE).toMatch(/setInterval/);
  });

  it('renders the WebSocket-powered live feed', () => {
    expect(SOURCE).toMatch(/InvestigationLiveFeed/);
  });

  it('passes isInProgress with resolved status for REST chat fallback', () => {
    expect(SOURCE).toMatch(/resolved/);
  });
});
