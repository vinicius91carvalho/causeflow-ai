/**
 * Polling regression — uses lightweight polling as WS fallback (not SSE).
 *
 * SSE was removed because it caused WebSocket relay disconnects on the
 * incident detail page. Polling is used ONLY as fallback when WebSocket
 * is not connected. When WS is active, status updates come via the relay.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'incident-detail.tsx'), 'utf8');

describe('Polling — uses polling, not SSE', () => {
  it('does not use SSE stream (removed — caused WS disconnects)', () => {
    expect(SOURCE).not.toMatch(/useIncidentStream/);
    expect(SOURCE).not.toMatch(/DisconnectedBanner/);
  });

  it('uses setInterval for status polling while in progress', () => {
    expect(SOURCE).toMatch(/\bsetInterval\b/);
    expect(SOURCE).toMatch(/POLL_INTERVAL_MS/);
  });

  it('cleans up interval on unmount', () => {
    expect(SOURCE).toMatch(/clearInterval/);
  });
});
