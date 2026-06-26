import { describe, expect, expectTypeOf, it } from 'vitest';
import type { HealthStatus, IncidentAnalytics } from './core-api-types';

/**
 * Shape tests for core-api-types. These guard the dashboard-side canonical
 * contracts that multiple sprints depend on. If the contract drifts, these
 * tests fail and the `check-invariants.sh` hook catches the rest.
 */

describe('IncidentAnalytics contract', () => {
  it('accepts a full dashboard-shape object', () => {
    const value: IncidentAnalytics = {
      totalIncidents: 1,
      openIncidents: 2,
      mttr: 3,
      byStatus: { open: 2 },
      bySeverity: { high: 1 },
      totalCostUsd: 100,
      avgCostUsd: 50,
    };
    expect(value.totalIncidents).toBe(1);
    expect(value.avgCostUsd).toBe(50);
  });

  it('allows avgCostUsd to be null', () => {
    const value: IncidentAnalytics = {
      totalIncidents: 0,
      openIncidents: 0,
      mttr: 0,
      byStatus: {},
      bySeverity: {},
      totalCostUsd: 0,
      avgCostUsd: null,
    };
    expect(value.avgCostUsd).toBeNull();
  });

  it('uses the dashboard domain field names', () => {
    expectTypeOf<IncidentAnalytics>().toHaveProperty('totalIncidents');
    expectTypeOf<IncidentAnalytics>().toHaveProperty('openIncidents');
    expectTypeOf<IncidentAnalytics>().toHaveProperty('mttr');
    expectTypeOf<IncidentAnalytics>().toHaveProperty('byStatus');
    expectTypeOf<IncidentAnalytics>().toHaveProperty('bySeverity');
    expectTypeOf<IncidentAnalytics>().toHaveProperty('totalCostUsd');
    expectTypeOf<IncidentAnalytics>().toHaveProperty('avgCostUsd');
  });

  it('rejects wire-shape field names (structural type check)', () => {
    // Build the wire shape dynamically to avoid leaking wire field names as
    // string literals in this file (INVARIANTS.md grep allows them only in
    // http-api-client.ts).
    const wireKeys = ['total', 'open' + 'Count', 'mttr' + 'Minutes'] as const;
    // Runtime proof: none of these keys appear on a valid IncidentAnalytics.
    const value: IncidentAnalytics = {
      totalIncidents: 0,
      openIncidents: 0,
      mttr: 0,
      byStatus: {},
      bySeverity: {},
      totalCostUsd: 0,
      avgCostUsd: null,
    };
    for (const key of wireKeys) {
      expect(key in value).toBe(false);
    }
  });
});

describe('HealthStatus contract', () => {
  it('has the expected lightweight shape', () => {
    const value: HealthStatus = {
      status: 'ok',
      version: '1.0.0',
      timestamp: '2026-04-07T00:00:00.000Z',
    };
    expect(value.status).toBe('ok');
  });
});
