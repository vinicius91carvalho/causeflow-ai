/**
 * Tests for the useIncidentStream hook.
 *
 * Two layers:
 * 1. Source-introspection — assert the hook contains the load-bearing
 *    primitives (incidentId filter, EventSource creation, cleanup).
 * 2. Smoke import — proves the module loads cleanly under the project's
 *    TS pipeline.
 *
 * Behavioral integration of the SSE flow is exercised end-to-end by the
 * Sprint 5 layout tests + manual orchestrator dev-server smoke check.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { useIncidentStream } from '../use-incident-stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'use-incident-stream.ts'), 'utf8');

describe('useIncidentStream — source invariants', () => {
  it('exports the hook', () => {
    expect(useIncidentStream).toBeDefined();
    expect(typeof useIncidentStream).toBe('function');
  });

  it('opens an EventSource against /api/incidents/{id}/stream', () => {
    expect(SOURCE).toMatch(/\/api\/incidents\/\$\{encodeURIComponent\(incidentId\)\}\/stream/);
    expect(SOURCE).toMatch(/new Ctor/);
  });

  it('filters dispatched events by incidentId', () => {
    // Tenant + incident isolation invariant from INVARIANTS.md
    expect(SOURCE).toMatch(/incidentId/);
    expect(SOURCE).toMatch(/eventIncidentId !== incidentIdRef\.current/);
  });

  it('cleans up the EventSource on unmount', () => {
    expect(SOURCE).toMatch(/closeSource/);
    expect(SOURCE).toMatch(/return\s*\(\s*\)\s*=>\s*\{[\s\S]*?closeSource\(\)/);
  });

  it('exposes a reconnect function (no automatic retry)', () => {
    expect(SOURCE).toMatch(/const reconnect/);
    expect(SOURCE).toMatch(/closeSource\(\)/);
    expect(SOURCE).toMatch(/openSource\(\)/);
  });

  it('degrades gracefully when EventSource is unavailable (mock mode)', () => {
    expect(SOURCE).toMatch(/getEventSourceCtor/);
    expect(SOURCE).toMatch(/setStatus\('disconnected'\)/);
  });

  it('exposes a status state', () => {
    expect(SOURCE).toMatch(/IncidentStreamStatus/);
    expect(SOURCE).toMatch(/setStatus\('connected'\)/);
    expect(SOURCE).toMatch(/setStatus\('error'\)/);
  });

  it('subscribes named event listeners for known event types', () => {
    expect(SOURCE).toMatch(/addEventListener/);
    expect(SOURCE).toMatch(/incident\.status_changed/);
    expect(SOURCE).toMatch(/audit\.appended/);
  });

  it('exposes an `on()` subscription that returns an unsubscribe function', () => {
    expect(SOURCE).toMatch(/handlersRef\.current/);
    expect(SOURCE).toMatch(/handlersRef\.current\.get\(eventType\)\?\.delete/);
  });

  it('registers listeners for snake_case names from core/src/bootstrap.ts', () => {
    // The Core in-process eventbus emits snake_case names — the dashboard MUST
    // listen for them or live updates from the in-process emitter never arrive.
    expect(SOURCE).toMatch(/'investigation_progress'/);
    expect(SOURCE).toMatch(/'investigation_completed'/);
    expect(SOURCE).toMatch(/'remediation_proposed'/);
  });

  it('normalizes snake_case event names to canonical dot-case before dispatching', () => {
    expect(SOURCE).toMatch(/EVENT_NAME_NORMALIZATION/);
    expect(SOURCE).toMatch(/canonicalizeEventName/);
    expect(SOURCE).toMatch(/investigation_progress:\s*'investigation\.progress'/);
    expect(SOURCE).toMatch(/remediation_proposed:\s*'remediation\.proposed'/);
  });
});
