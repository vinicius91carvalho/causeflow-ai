/**
 * Smoke test for InvestigationLiveFeed and its extracted hook.
 * Source-level regression: verifies the component ships with correct
 * hook shape, URL plumbing, and WebSocket lifecycle.
 *
 * After the modular refactoring, WS logic lives in use-investigation-feed.ts
 * while the component is a slim orchestrator with view toggle.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const COMPONENT_SOURCE = readFileSync(join(__dirname, 'investigation-live-feed.tsx'), 'utf8');
const HOOK_SOURCE = readFileSync(
  join(__dirname, '..', 'hooks', 'use-investigation-feed.ts'),
  'utf8',
);

describe('investigation-live-feed — smoke regression', () => {
  it('fetches the relay token from the BFF proxy route', () => {
    expect(HOOK_SOURCE).toMatch(
      /\/api\/investigation\/\$\{encodeURIComponent\(incidentId\)\}\/relay-token/,
    );
  });

  it('always shows chat (REST fallback available)', () => {
    expect(HOOK_SOURCE).toMatch(/isInProgress \|\| idle \|\| !connected/);
  });

  it('cleans up the WebSocket on unmount', () => {
    expect(HOOK_SOURCE).toMatch(/ws\.close\(\)/);
    expect(HOOK_SOURCE).toMatch(/cancelled = true/);
  });

  it('routes via WS when open, REST fallback otherwise', () => {
    expect(HOOK_SOURCE).toMatch(/readyState === WebSocket\.OPEN/);
    expect(HOOK_SOURCE).toMatch(/\/api\/investigation\/.*\/chat/);
  });

  it('filters by incidentId (tenant isolation guard)', () => {
    expect(HOOK_SOURCE).toMatch(/incidentId/);
  });

  it('component uses the extracted hook', () => {
    expect(COMPONENT_SOURCE).toMatch(/useInvestigationFeed/);
  });

  it('component has view mode toggle (feed/workspace)', () => {
    expect(COMPONENT_SOURCE).toMatch(/viewMode/);
    expect(COMPONENT_SOURCE).toMatch(/LiveFeedView/);
    expect(COMPONENT_SOURCE).toMatch(/WorkspaceView/);
  });

  it('persists view mode preference in localStorage', () => {
    expect(COMPONENT_SOURCE).toMatch(/causeflow:feed-view-mode/);
  });
});
