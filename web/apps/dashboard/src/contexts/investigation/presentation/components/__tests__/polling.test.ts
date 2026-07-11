/**
 * Polling regression — lightweight polling remains as WS fallback.
 *
 * AC-025 re-enables the incident SSE stream (useIncidentStream) alongside
 * the WebSocket live feed. Polling is still used ONLY when WebSocket is
 * not connected.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'incident-detail.tsx'), 'utf8');

describe('Polling — WS fallback alongside SSE', () => {
  it('opens the incident SSE stream (AC-025)', () => {
    expect(SOURCE).toMatch(/useIncidentStream/);
  });

  it('uses setInterval for status polling while in progress', () => {
    expect(SOURCE).toMatch(/\bsetInterval\b/);
    expect(SOURCE).toMatch(/POLL_INTERVAL_MS/);
  });

  it('cleans up interval on unmount', () => {
    expect(SOURCE).toMatch(/clearInterval/);
  });

  it('skips polling when WebSocket is connected', () => {
    expect(SOURCE).toMatch(/wsConnectedRef\.current/);
  });
});
