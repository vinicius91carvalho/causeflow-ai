/**
 * E2E tests for Composio OAuth integration flows.
 *
 * Covers:
 * - Sentry connected via Composio → "Add Trigger" button shows translated trigger label
 * - Composio OAuth callback reads connectedAccountId (camelCase) correctly
 * - Slack card shows settings panel when connected
 * - Toast handler shows success/error messages from Composio redirect
 *
 * Runs under the `dashboard-authed` project (requires auth-setup.ts to complete).
 */

import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';

function mockIntegrationsRoute(page: Parameters<typeof test>[1]['page'], integrations: unknown[]) {
  return page.route('**/api/integrations', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ integrations }),
      });
    }
    return route.continue();
  });
}

function mockTriggersRoute(page: Parameters<typeof test>[1]['page']) {
  return page.route('**/api/integrations/triggers', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ triggers: [] }),
      });
    }
    return route.continue();
  });
}

/** Minimal catalog mock — enough metadata for integration cards to render. */
function mockCatalogRoute(
  page: Parameters<typeof test>[1]['page'],
  extraProviders: Array<{ id: string; name: string; category: string; type: string }> = [],
) {
  const base = [
    {
      id: 'sentry',
      name: 'Sentry',
      category: 'monitoring',
      type: 'oauth',
      description: '',
      logo: '',
    },
    {
      id: 'pagerduty',
      name: 'PagerDuty',
      category: 'monitoring',
      type: 'oauth',
      description: '',
      logo: '',
    },
    {
      id: 'datadog',
      name: 'Datadog',
      category: 'monitoring',
      type: 'oauth',
      description: '',
      logo: '',
    },
    {
      id: 'slack',
      name: 'Slack',
      category: 'communication',
      type: 'oauth',
      description: '',
      logo: '',
    },
    {
      id: 'aws',
      name: 'Amazon Web Services',
      category: 'cloud',
      type: 'credential',
      description: '',
      logo: '',
    },
  ];
  return page.route('**/api/integrations/catalog', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ providers: [...base, ...extraProviders] }),
    });
  });
}

function blockAnalytics(page: Parameters<typeof test>[1]['page']) {
  return Promise.all([
    page.route('**/*.clarity.ms/**', (r) => r.abort()),
    page.route('**/google-analytics.com/**', (r) => r.abort()),
    page.route('**/googletagmanager.com/**', (r) => r.abort()),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sentry + Composio trigger catalog tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sentry — trigger catalog visibility', () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await mockCatalogRoute(page);
    await mockTriggersRoute(page);
  });

  test('shows Add Trigger button for connected Sentry card', async ({ page }) => {
    await mockIntegrationsRoute(page, [
      {
        type: 'sentry',
        provider: 'sentry',
        name: 'Sentry',
        status: 'connected',
        source: 'composio',
        createdAt: new Date().toISOString(),
      },
    ]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`);
    await expect(page.locator('main')).toBeVisible();

    const addTriggerBtn = page.locator('[aria-label="Add trigger for Sentry"]');
    await expect(addTriggerBtn).toBeVisible({ timeout: 15000 });
  });

  test('SENTRY_NEW_ISSUE translated label appears in trigger dropdown', async ({ page }) => {
    await mockIntegrationsRoute(page, [
      {
        type: 'sentry',
        provider: 'sentry',
        name: 'Sentry',
        status: 'connected',
        source: 'composio',
      },
    ]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`);
    await expect(page.locator('main')).toBeVisible();

    const addTriggerBtn = page.locator('[aria-label="Add trigger for Sentry"]');
    await expect(addTriggerBtn).toBeVisible({ timeout: 15000 });
    await addTriggerBtn.click();

    // Trigger label translated from triggers.sentry.new_issue → "New issue detected"
    const triggerOption = page.locator('button').filter({ hasText: 'New issue detected' });
    await expect(triggerOption).toBeVisible();
  });

  test('Sentry card heading is visible when connected', async ({ page }) => {
    await mockIntegrationsRoute(page, [
      {
        type: 'sentry',
        provider: 'sentry',
        name: 'Sentry',
        status: 'connected',
        source: 'composio',
      },
    ]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`);
    await expect(page.locator('main')).toBeVisible();

    // Use role-based locator to avoid strict mode violations from description text
    await expect(page.getByRole('heading', { name: 'Sentry' })).toBeVisible({ timeout: 15000 });

    // Connected Sentry should NOT show the "Connect" button
    const connectBtn = page.locator('[aria-label*="Connect Sentry"]');
    await expect(connectBtn).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PagerDuty / Datadog trigger catalog
// ─────────────────────────────────────────────────────────────────────────────

test.describe('PagerDuty / Datadog — trigger catalog', () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await mockCatalogRoute(page);
    await mockTriggersRoute(page);
  });

  test('connected PagerDuty shows translated incident_triggered label', async ({ page }) => {
    await mockIntegrationsRoute(page, [
      {
        type: 'pagerduty',
        provider: 'pagerduty',
        name: 'PagerDuty',
        status: 'connected',
        source: 'composio',
      },
    ]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`);
    await expect(page.locator('main')).toBeVisible();

    const addTriggerBtn = page.locator('[aria-label="Add trigger for PagerDuty"]');
    await expect(addTriggerBtn).toBeVisible({ timeout: 15000 });
    await addTriggerBtn.click();

    const triggerOption = page.locator('button').filter({ hasText: 'Incident triggered' });
    await expect(triggerOption).toBeVisible();
  });

  test('connected Datadog shows translated monitor_triggered label', async ({ page }) => {
    await mockIntegrationsRoute(page, [
      {
        type: 'datadog',
        provider: 'datadog',
        name: 'Datadog',
        status: 'connected',
        source: 'composio',
      },
    ]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`);
    await expect(page.locator('main')).toBeVisible();

    const addTriggerBtn = page.locator('[aria-label="Add trigger for Datadog"]');
    await expect(addTriggerBtn).toBeVisible({ timeout: 15000 });
    await addTriggerBtn.click();

    const triggerOption = page.locator('button').filter({ hasText: 'Monitor alert triggered' });
    await expect(triggerOption).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Slack settings panel
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Slack — settings panel', () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await mockCatalogRoute(page);
    await mockTriggersRoute(page);
    await page.route('**/api/integrations/slack/config', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: true,
          workspaceName: 'CauseFlow AI',
          channel: '#incidents',
          botUserId: 'U123',
        }),
      });
    });
  });

  test('Slack card heading visible when connected', async ({ page }) => {
    await mockIntegrationsRoute(page, [
      {
        type: 'slack',
        provider: 'slack',
        name: 'Slack',
        status: 'connected',
        source: 'slack_oauth',
        workspaceName: 'CauseFlow AI',
      },
    ]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`);
    await expect(page.locator('main')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Slack' })).toBeVisible({ timeout: 15000 });
  });

  test('connected Slack shows translated receive_message trigger', async ({ page }) => {
    await mockIntegrationsRoute(page, [
      { type: 'slack', provider: 'slack', name: 'Slack', status: 'connected', source: 'composio' },
    ]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`);
    await expect(page.locator('main')).toBeVisible();

    const addTriggerBtn = page.locator('[aria-label="Add trigger for Slack"]');
    await expect(addTriggerBtn).toBeVisible({ timeout: 15000 });
    await addTriggerBtn.click();

    const triggerOption = page.locator('button').filter({ hasText: 'New message received' });
    await expect(triggerOption).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Composio OAuth callback — camelCase connectedAccountId (Bug B regression)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Composio OAuth callback — connectedAccountId param handling', () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await mockCatalogRoute(page);
    await mockIntegrationsRoute(page, []);
    await mockTriggersRoute(page);
  });

  test('callback with connectedAccountId (camelCase) leaves the callback URL', async ({ page }) => {
    // Navigate to callback URL with camelCase connectedAccountId (the format Composio sends).
    // Next.js handler reads it and calls Core API finalize.
    // Result: redirect to ?connected=sentry (success) or ?connect_error=... (Core API not ready).
    // Either way, the browser MUST leave the /api/oauth/sentry/callback URL.
    const callbackUrl = `${DASHBOARD_URL}/api/integrations/oauth/sentry/callback?status=success&connectedAccountId=ca_e2e_test_camel&appName=sentry`;
    await page.goto(callbackUrl, { waitUntil: 'domcontentloaded' });

    // Wait until navigation leaves the callback URL (redirect happened)
    await page.waitForURL((url) => !url.pathname.includes('/oauth/sentry/callback'), {
      timeout: 20000,
    });

    const finalUrl = page.url();
    // Must not stay on callback URL — Composio redirect was processed
    expect(finalUrl).not.toMatch(/oauth\/sentry\/callback/);
    // Must redirect toward integrations (or sign-in with integrations as next URL)
    expect(finalUrl).toMatch(/integrations/);
  });

  test('callback with snake_case connected_account_id (legacy fallback) also leaves callback URL', async ({
    page,
  }) => {
    const callbackUrl = `${DASHBOARD_URL}/api/integrations/oauth/sentry/callback?status=success&connected_account_id=ca_e2e_test_snake&appName=sentry`;
    await page.goto(callbackUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForURL((url) => !url.pathname.includes('/oauth/sentry/callback'), {
      timeout: 20000,
    });

    expect(page.url()).not.toMatch(/oauth\/sentry\/callback/);
    expect(page.url()).toMatch(/integrations/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Toast handler — ?connected and ?connect_error params
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Toast handler — Composio redirect params', () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await mockCatalogRoute(page);
    await mockIntegrationsRoute(page, []);
    await mockTriggersRoute(page);
  });

  test('?connected=sentry strips the param from URL after toast', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations?connected=sentry`);
    await expect(page.locator('main')).toBeVisible();

    // Toast handler should strip the ?connected param via router.replace
    await page.waitForURL((url) => !url.searchParams.has('connected'), { timeout: 10000 });
    expect(page.url()).not.toContain('connected=sentry');
  });

  test('?connect_error strips the error param from URL after toast', async ({ page }) => {
    await page.goto(
      `${DASHBOARD_URL}/en/dashboard/integrations?connect_error=${encodeURIComponent('Not Found')}`,
    );
    await expect(page.locator('main')).toBeVisible();

    await page.waitForURL((url) => !url.searchParams.has('connect_error'), { timeout: 10000 });
    expect(page.url()).not.toContain('connect_error');
  });
});
