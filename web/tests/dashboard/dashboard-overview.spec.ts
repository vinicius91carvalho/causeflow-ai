/**
 * Dashboard Overview — Playwright E2E spec (Sprint 5)
 *
 * Verifies the rebuilt dashboard overview against PRD §11 AC-1..AC-9:
 *   1. Branch A — no analyses, no integrations
 *   2. Branch B — no analyses, has integrations
 *   3. Branch C — full dashboard (all 7 sections + metrics)
 *   4. Section error fence — one section returns 500, page does not crash
 *   5. /api/health contract — URL must be exactly /api/health
 *
 * Auth: dashboard-authed project storageState (local JWT via auth-setup.ts).
 * All /api/* routes are stubbed via page.route() — no real Core API contacted.
 */

import type { Page, Request, Response, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

// ─── Config ───────────────────────────────────────────────────────────────────

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';

// ─── Canned response data ─────────────────────────────────────────────────────

const METRICS_EMPTY = {
  metrics: {
    totalAnalyses: 0,
    activeIntegrations: 0,
    teamMembers: 1,
    creditsTotal: 5,
    creditsUsed: 0,
    creditsRemaining: 5,
    plan: 'free',
  },
};

const METRICS_FULL = {
  metrics: {
    totalAnalyses: 42,
    activeIntegrations: 3,
    teamMembers: 1,
    creditsTotal: 20,
    creditsUsed: 3,
    creditsRemaining: 17,
    plan: 'starter',
  },
};

const INTEGRATION_ONE = [{ id: 'int-1', type: 'github', status: 'active', name: 'GitHub' }];

const INTEGRATIONS_THREE = [
  { id: 'int-1', type: 'github', status: 'active', name: 'GitHub' },
  { id: 'int-2', type: 'slack', status: 'active', name: 'Slack' },
  { id: 'int-3', type: 'jira', status: 'active', name: 'Jira' },
];

const HEALTH_OK = { status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() };
const INCIDENTS_EMPTY = { items: [], cursor: null };
const APPROVALS_EMPTY: unknown[] = [];
const NOTIFICATIONS_EMPTY = { items: [], cursor: null };
const TOPOLOGY_HEALTH_OK = {
  overall: 'ok',
  services: [],
  summary: { healthy: 5, degraded: 0, down: 0, total: 5 },
};
const RELAY_STATUS_OK = {
  connected: true,
  latencyMs: 45,
  version: '1.0.0',
  lastHeartbeat: new Date().toISOString(),
};
const MEMORY_INSIGHTS_OK = {
  insights: [
    { id: 'ins-1', summary: 'Database spikes correlate with deploy events.', confidence: 0.87 },
  ],
};
const USAGE_HISTORY_OK = {
  items: [{ month: '2026-03', investigationsUsed: 3, investigationsLimit: 20 }],
  cursor: null,
};

// ─── Route stub helper ────────────────────────────────────────────────────────

type EndpointOverride = { status: number; body: unknown };
type OverrideMap = Partial<Record<string, EndpointOverride>>;

/**
 * Intercept every /api/* the dashboard hits with canned JSON. Per-test overrides
 * can flip individual endpoints to empty arrays or 500 errors. Longest-prefix
 * match wins so '/api/memory/insights' beats '/api/memory'.
 */
async function stubEndpoints(page: Page, overrides: OverrideMap = {}): Promise<void> {
  const defaults: Record<string, EndpointOverride> = {
    '/api/metrics': { status: 200, body: METRICS_FULL },
    '/api/integrations': { status: 200, body: INTEGRATIONS_THREE },
    '/api/health': { status: 200, body: HEALTH_OK },
    '/api/incidents': { status: 200, body: INCIDENTS_EMPTY },
    '/api/approvals/pending': { status: 200, body: APPROVALS_EMPTY },
    '/api/notifications': { status: 200, body: NOTIFICATIONS_EMPTY },
    '/api/topology/health': { status: 200, body: TOPOLOGY_HEALTH_OK },
    '/api/relay/status': { status: 200, body: RELAY_STATUS_OK },
    '/api/memory/insights': { status: 200, body: MEMORY_INSIGHTS_OK },
    '/api/billing/usage': { status: 200, body: USAGE_HISTORY_OK },
  };

  const merged: Record<string, EndpointOverride> = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) merged[key] = value;
  }

  await page.route('**/api/**', async (route: Route) => {
    const url = route.request().url();

    const matchKey = Object.keys(merged)
      .filter((key) => url.includes(key))
      .sort((a, b) => b.length - a.length)[0];

    if (!matchKey) {
      // Pass through unrecognised /api/* routes (e.g. Clerk-internal calls)
      await route.continue();
      return;
    }

    const { status, body } = merged[matchKey];
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

// ─── Shared listeners ─────────────────────────────────────────────────────────

let consoleErrors: string[] = [];
let pageErrors: Error[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  // Block analytics/trackers
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

test('1. Branch A — no analyses, no integrations', async ({ page }) => {
  await stubEndpoints(page, {
    '/api/metrics': { status: 200, body: METRICS_EMPTY },
    '/api/integrations': { status: 200, body: [] },
  });

  await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-testid="branch-a-empty-state"]')).toBeVisible({
    timeout: 15000,
  });

  const connectCta = page.locator('[data-testid="cta-connect-integration"]');
  await expect(connectCta).toBeVisible();
  await expect(connectCta).toHaveAttribute('href', '/dashboard/integrations');

  const relayCta = page.locator('[data-testid="cta-setup-relay"]');
  await expect(relayCta).toBeVisible();
  await expect(relayCta).toHaveAttribute('href', /\/dashboard\/(relay|integrations)/);
});

test('2. Branch B — no analyses, has integrations (legacy raw array shape)', async ({ page }) => {
  await stubEndpoints(page, {
    '/api/metrics': { status: 200, body: METRICS_EMPTY },
    '/api/integrations': { status: 200, body: INTEGRATION_ONE },
  });

  await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-testid="branch-b-empty-state"]')).toBeVisible({
    timeout: 15000,
  });

  // Regression guard: Branch A must NOT also be visible
  await expect(page.locator('[data-testid="branch-a-empty-state"]')).toHaveCount(0);

  const analysisCta = page.locator('[data-testid="cta-create-first-analysis"]');
  await expect(analysisCta).toBeVisible();
  await expect(analysisCta).toHaveAttribute('href', '/dashboard/analyses/new');
});

test('2b. Branch B — wrapped { integrations: [...] } shape (the production contract)', async ({
  page,
}) => {
  // Reproduces the bug fixed in Sprint 03: the production /api/integrations
  // returns { integrations: [...] }, not a raw array. The DashboardOverview
  // consumer must extract `.integrations` to compute hasIntegrations.
  await stubEndpoints(page, {
    '/api/metrics': { status: 200, body: METRICS_EMPTY },
    '/api/integrations': {
      status: 200,
      body: { integrations: [{ id: 'aws' }, { id: 'github' }] },
    },
  });

  await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-testid="branch-b-empty-state"]')).toBeVisible({
    timeout: 15000,
  });
  // Regression guard: must NOT fall through to Branch A
  await expect(page.locator('[data-testid="branch-a-empty-state"]')).toHaveCount(0);
});

test('3. Branch C — full dashboard with all sections', async ({ page }) => {
  const apiResponses: Array<{ url: string; status: number }> = [];

  page.on('response', (response: Response) => {
    const url = response.url();
    if (url.includes('/api/') && !url.includes('clerk')) {
      apiResponses.push({ url, status: response.status() });
    }
  });

  await stubEndpoints(page);
  await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-testid="system-operational-card"]')).toBeVisible({
    timeout: 15000,
  });

  await expect(page.locator('[data-testid="active-incidents-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="pending-approvals-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="recent-notifications-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="system-health-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="relay-status-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="memory-insights-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="usage-history-section"]')).toBeVisible();

  const totalAnalysesCard = page.locator('[data-testid="metric-total-analyses"]');
  await expect(totalAnalysesCard).toBeVisible();
  await expect(totalAnalysesCard).toContainText('42');

  // metric-monthly-analyses card was removed in Sprint 4
  await expect(page.locator('[data-testid="metric-monthly-analyses"]')).toHaveCount(0);

  // Every stubbed /api/* response returned 200
  const nonTwoHundred = apiResponses.filter((r) => r.status !== 200);
  expect(nonTwoHundred, `Non-200 responses: ${JSON.stringify(nonTwoHundred)}`).toHaveLength(0);
});

test('4. Section error fence — /api/memory/insights 500 does not crash page', async ({ page }) => {
  await stubEndpoints(page, {
    '/api/memory/insights': { status: 500, body: { error: 'Internal Server Error' } },
  });

  await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

  // Page did not crash — operational card and other sections still render
  await expect(page.locator('[data-testid="system-operational-card"]')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator('[data-testid="memory-insights-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="active-incidents-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="pending-approvals-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="recent-notifications-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="system-health-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="relay-status-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="usage-history-section"]')).toBeVisible();
});

test('5. /api/health contract — URL must be exactly /api/health', async ({ page }) => {
  const healthPaths: string[] = [];

  await stubEndpoints(page);

  page.on('request', (request: Request) => {
    const url = request.url();
    if (url.includes('/api/health')) {
      healthPaths.push(new URL(url).pathname);
    }
  });

  await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="system-operational-card"]')).toBeVisible({
    timeout: 15000,
  });

  expect(healthPaths.length, 'expected at least one /api/health request').toBeGreaterThan(0);
  for (const pathname of healthPaths) {
    expect(pathname).toMatch(/^\/api\/health$/);
  }
});
