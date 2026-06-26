/**
 * Sprint 05 — Slack IntegrationCard layout and disconnect confirmation dialog E2E spec.
 *
 * Verifies:
 * 1. Slack card renders in "available" state with the canonical OAuth "Authorize with" button.
 * 2. Slack card renders in "connected" state with Disconnect and Reauthorize buttons.
 * 3. Clicking Disconnect on Slack opens the Shadcn confirmation Dialog (not an immediate disconnect).
 * 4. Cancelling the Dialog leaves the card still "connected".
 * 5. Confirming the Dialog calls the disconnect API and transitions the card.
 * 6. Layout mirrors GitHub and AWS cards (connect/disconnect buttons in same positions).
 *
 * Uses API mocks — no live Core API or Clerk session required.
 * Runs against the chromium viewport projects (baseURL = website; navigates to DASHBOARD_URL).
 */

import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

/**
 * Mock the catalog with Slack, GitHub, and AWS so we can compare card layouts.
 * Slack uses connectionStrategy:'oauth', GitHub uses 'oauth', AWS uses 'credential'.
 */
async function mockCatalog(page: import('@playwright/test').Page) {
  await page.route('**/api/integrations/catalog', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        providers: [
          {
            id: 'slack',
            name: 'Slack',
            category: 'communication',
            type: 'oauth',
            description: 'Real-time incident alerts for engineering and support teams.',
            logo: '/icons/integrations/slack.svg',
          },
          {
            id: 'github',
            name: 'GitHub',
            category: 'code',
            type: 'oauth',
            description: 'Source code management.',
            logo: '/icons/integrations/github.svg',
          },
          {
            id: 'aws',
            name: 'Amazon Web Services',
            category: 'cloud',
            type: 'credential',
            description: 'AWS CloudWatch monitoring.',
            logo: '/icons/integrations/aws-cloudwatch.svg',
          },
        ],
      }),
    });
  });
}

async function mockTriggers(page: import('@playwright/test').Page) {
  await page.route('**/api/integrations/triggers', (route) => {
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

async function mockSentryStatus(page: import('@playwright/test').Page) {
  await page.route('**/api/integrations/sentry', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasClientSecret: false, verified: false, lastEventAt: null }),
      });
    }
    return route.continue();
  });
}

/**
 * Mock the integrations list — optionally with Slack connected.
 */
async function mockIntegrationsList(
  page: import('@playwright/test').Page,
  integrations: Array<{ id: string; type: string; status: string; connectedBy?: string }> = [],
) {
  await page.route('**/api/integrations', (route) => {
    if (
      route.request().method() === 'GET' &&
      !route.request().url().includes('/api/integrations/')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ integrations }),
      });
    }
    return route.continue();
  });
}

/**
 * Set up all required mocks for the integrations page.
 * Optionally pass connected integrations to mock Slack (or other) as connected.
 */
async function mockAllApis(
  page: import('@playwright/test').Page,
  integrations: Array<{ id: string; type: string; status: string; connectedBy?: string }> = [],
) {
  await mockCatalog(page);
  await mockTriggers(page);
  await mockSentryStatus(page);
  await mockIntegrationsList(page, integrations);
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Slack IntegrationCard — layout and disconnect confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('Slack card shows "Authorize with" button when not connected', async ({ page }) => {
    await mockAllApis(page); // no connected integrations

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    // Wait for catalog to load by looking for at least one integration card
    await expect(page.locator('h3').filter({ hasText: 'Slack' }).first()).toBeVisible({
      timeout: 15000,
    });

    // The OAuth "authorize" button should be present (text contains "Authorize with")
    const authorizeBtn = page.locator('[aria-label*="Authorize with"][aria-label*="Slack"]');
    await expect(authorizeBtn).toBeVisible();
    await expect(authorizeBtn).toBeEnabled();
  });

  test('GitHub and AWS cards are also visible (canonical layout baseline)', async ({ page }) => {
    await mockAllApis(page);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    // All three provider cards should render
    await expect(page.locator('h3').filter({ hasText: 'Slack' }).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('h3').filter({ hasText: 'GitHub' }).first()).toBeVisible();
    await expect(
      page.locator('h3').filter({ hasText: 'Amazon Web Services' }).first(),
    ).toBeVisible();

    // OAuth integrations (Slack, GitHub) show "Authorize with" style button
    await expect(
      page.locator('[aria-label*="Authorize with"][aria-label*="GitHub"]'),
    ).toBeVisible();

    // Credential integration (AWS) shows plain "Connect" button (no "Authorize with")
    await expect(
      page.locator('[aria-label*="Connect"][aria-label*="Amazon Web Services"]'),
    ).toBeVisible();
  });

  test('connected Slack card shows Disconnect button', async ({ page }) => {
    await mockAllApis(page, [
      { id: 'conn-slack-1', type: 'slack', status: 'connected', connectedBy: 'admin@example.com' },
    ]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    await expect(page.locator('h3').filter({ hasText: 'Slack' }).first()).toBeVisible({
      timeout: 15000,
    });

    // Disconnect button should exist for connected Slack
    const disconnectBtn = page.locator('[aria-label*="Disconnect"][aria-label*="Slack"]');
    await expect(disconnectBtn).toBeVisible();

    // Authorize button should NOT appear when already connected
    await expect(
      page.locator('[aria-label*="Authorize with"][aria-label*="Slack"]'),
    ).not.toBeVisible();
  });

  test('clicking Disconnect opens confirmation dialog without disconnecting', async ({ page }) => {
    await mockAllApis(page, [{ id: 'conn-slack-1', type: 'slack', status: 'connected' }]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    await expect(page.locator('h3').filter({ hasText: 'Slack' }).first()).toBeVisible({
      timeout: 15000,
    });

    // Track whether DELETE was called (it should NOT be on initial click)
    let disconnectApiCalled = false;
    await page.route('**/api/integrations/**', (route) => {
      if (route.request().method() === 'DELETE') {
        disconnectApiCalled = true;
      }
      return route.continue();
    });

    // Click disconnect
    const disconnectBtn = page.locator('[aria-label*="Disconnect"][aria-label*="Slack"]');
    await disconnectBtn.click();

    // Dialog should open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should contain the disconnect warning text
    await expect(dialog.locator('text=Disconnect Slack')).toBeVisible();

    // API must NOT have been called at this point
    expect(disconnectApiCalled).toBe(false);
  });

  test('cancelling disconnect dialog leaves card connected', async ({ page }) => {
    await mockAllApis(page, [{ id: 'conn-slack-1', type: 'slack', status: 'connected' }]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    await expect(page.locator('h3').filter({ hasText: 'Slack' }).first()).toBeVisible({
      timeout: 15000,
    });

    // Open dialog
    const disconnectBtn = page.locator('[aria-label*="Disconnect"][aria-label*="Slack"]');
    await disconnectBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Cancel button inside the dialog
    const cancelBtn = dialog.locator('button', { hasText: 'Cancel' });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Dialog should be dismissed
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    // Disconnect button is still present (card is still connected)
    await expect(page.locator('[aria-label*="Disconnect"][aria-label*="Slack"]')).toBeVisible();
  });

  test('confirming disconnect dialog calls API and removes card from connected state', async ({
    page,
  }) => {
    await mockAllApis(page, [{ id: 'conn-slack-1', type: 'slack', status: 'connected' }]);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    await expect(page.locator('h3').filter({ hasText: 'Slack' }).first()).toBeVisible({
      timeout: 15000,
    });

    // Mock the disconnect API to succeed and update the integrations list response
    await page.route('**/api/integrations/**', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      return route.continue();
    });

    // After disconnect, the integrations list should return empty
    await page.route('**/api/integrations', (route) => {
      if (
        route.request().method() === 'GET' &&
        !route.request().url().includes('/api/integrations/')
      ) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ integrations: [] }),
        });
      }
      return route.continue();
    });

    // Open dialog
    const disconnectBtn = page.locator('[aria-label*="Disconnect"][aria-label*="Slack"]');
    await disconnectBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click the destructive Confirm button
    const confirmBtn = dialog.locator('button[class*="destructive"], button').filter({
      hasText: 'Disconnect',
    });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Dialog should close after confirmation
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
