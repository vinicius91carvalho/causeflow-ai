/**
 * Smoke test for IncidentDetail.
 *
 * Verifies the component uses WS relay for real-time updates with polling
 * as fallback only. SSE was removed because it caused WebSocket relay disconnects.
 * Status updates now flow through InvestigationLiveFeed callbacks (onStatusChange).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, 'incident-detail.tsx'), 'utf8');

describe('incident-detail.tsx — SSE removal regression', () => {
  it('does not use SSE stream (causes WS relay disconnects)', () => {
    expect(SOURCE).not.toMatch(/useIncidentStream/);
    expect(SOURCE).not.toMatch(/DisconnectedBanner/);
  });

  it('uses polling for status updates while in progress', () => {
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
