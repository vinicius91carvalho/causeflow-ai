import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, './dashboard-overview.tsx'), 'utf-8');

describe('DashboardOverview — source invariants', () => {
  it('no longer imports WelcomeTour (replaced by OnboardingOrchestrator in layout)', () => {
    expect(source).not.toContain("from './welcome-tour'");
    expect(source).not.toContain('<WelcomeTour');
  });

  it('does not render "Analyses this month" metric card', () => {
    expect(source).not.toContain('monthlyAnalyses');
    expect(source).not.toContain('Calendar');
  });

  it('uses Promise.all to fetch metrics and integrations in parallel', () => {
    expect(source).toContain('Promise.all');
    expect(source).toContain('/api/metrics');
    expect(source).toContain('/api/integrations');
  });

  it('calls selectEmptyStateBranch with hasAnalyses and hasIntegrations', () => {
    expect(source).toContain('selectEmptyStateBranch');
    expect(source).toContain('hasAnalyses');
    expect(source).toContain('hasIntegrations');
  });

  it('renders BranchAEmptyState for branch A', () => {
    expect(source).toContain('BranchAEmptyState');
    expect(source).toContain("branch === 'A'");
  });

  it('renders BranchBEmptyState for branch B', () => {
    expect(source).toContain('BranchBEmptyState');
    expect(source).toContain("branch === 'B'");
  });

  it('renders Branch C layout with metrics and no credits banner', () => {
    expect(source).toContain("branch === 'C'");
    expect(source).toContain('MetricsCard');
    expect(source).not.toContain('CreditsBanner');
  });

  it('does not render the 7 removed sections', () => {
    expect(source).not.toContain('ActiveIncidentsSection');
    expect(source).not.toContain('PendingApprovalsSection');
    expect(source).not.toContain('RecentNotificationsSection');
    expect(source).not.toContain('SystemHealthSection');
    expect(source).not.toContain('RelayStatusSection');
    expect(source).not.toContain('MemoryInsightsSection');
    expect(source).not.toContain('UsageHistorySection');
  });

  it('includes data-testid="metric-total-analyses" for total analyses card', () => {
    expect(source).toContain('metric-total-analyses');
  });

  it('reads totalAnalyses from metrics (not totalIncidents directly)', () => {
    // metrics.totalAnalyses is set from the /api/metrics endpoint which already
    // maps analytics.totalIncidents → totalAnalyses (see metrics-handler.ts)
    expect(source).toContain('metrics?.totalAnalyses');
  });

  it('uses AbortController in the top-level fetch', () => {
    expect(source).toContain('AbortController');
  });
});

describe('DashboardOverview — integration extraction fix (Sprint 03 ui-polish)', () => {
  // Production bug: consumer called Array.isArray() on `{ integrations: [...] }`
  // wrapper object (always false) → integrationCount stayed 0 → Branch A always selected.
  // Fix: extract `.integrations` when response is wrapped, fall back to raw array.
  it('extracts `.integrations` property from wrapped response shape', () => {
    expect(source).toContain('json.integrations');
  });

  it('tolerates raw array shape for back-compat', () => {
    expect(source).toMatch(/Array\.isArray\(json\)/);
  });

  it('documents the contract with an inline comment', () => {
    expect(source).toContain('/api/integrations returns { integrations:');
  });

  it('no longer performs the buggy Array.isArray on the raw response', () => {
    expect(source).not.toMatch(/as unknown\[\];[\s\S]*?Array\.isArray\(integrations\)/);
  });
});

describe('DashboardOverview — branch logic', () => {
  it('branch A selected when hasAnalyses=false and hasIntegrations=false', async () => {
    const { selectEmptyStateBranch } = await import('../lib/empty-state-branch');
    expect(selectEmptyStateBranch({ hasAnalyses: false, hasIntegrations: false })).toBe('A');
  });

  it('branch B selected when hasAnalyses=false and hasIntegrations=true', async () => {
    const { selectEmptyStateBranch } = await import('../lib/empty-state-branch');
    expect(selectEmptyStateBranch({ hasAnalyses: false, hasIntegrations: true })).toBe('B');
  });

  it('branch C selected when hasAnalyses=true regardless of integrations', async () => {
    const { selectEmptyStateBranch } = await import('../lib/empty-state-branch');
    expect(selectEmptyStateBranch({ hasAnalyses: true, hasIntegrations: false })).toBe('C');
    expect(selectEmptyStateBranch({ hasAnalyses: true, hasIntegrations: true })).toBe('C');
  });
});
