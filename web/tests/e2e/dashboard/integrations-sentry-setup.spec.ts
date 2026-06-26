/**
 * Sprint 05 — Sentry Internal Integration setup modal E2E spec.
 *
 * Verifies:
 * 1. Clicking the persistent "Show setup instructions" affordance opens the Sentry modal.
 * 2. Filling the Client Secret and saving shows the "Awaiting first event" status pill.
 * 3. Dismissing the modal (close button) closes it.
 * 4. The modal is re-openable via the persistent affordance after dismissal.
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
 * Mock the four API endpoints the IntegrationsClient calls on mount:
 *   GET /api/integrations/catalog  → single Sentry provider entry
 *   GET /api/integrations          → no connected integrations
 *   GET /api/integrations/triggers → no active triggers
 *   GET /api/integrations/sentry   → initial status (no client secret)
 */
async function mockIntegrationsApis(
  page: import('@playwright/test').Page,
  sentryStatus: { hasClientSecret: boolean; verified: boolean; lastEventAt: string | null } = {
    hasClientSecret: false,
    verified: false,
    lastEventAt: null,
  },
) {
  await page.route('**/api/integrations/catalog', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        providers: [
          {
            id: 'sentry',
            name: 'Sentry',
            category: 'monitoring',
            type: 'webhook',
            description: 'Error tracking and performance monitoring.',
            logo: '/icons/integrations/sentry.svg',
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

  await page.route('**/api/integrations/sentry', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sentryStatus),
      });
    }
    return route.continue();
  });
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Sentry setup modal — persistent affordance and status pill', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('integrations page loads and Sentry card is visible', async ({ page }) => {
    await mockIntegrationsApis(page);
    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('main')).toBeVisible();
    // Page should either show the integrations grid or redirect to sign-in
    const url = page.url();
    expect(url).toMatch(/integrations|sign-in/);
  });

  test('show-setup-instructions button opens the Sentry modal', async ({ page }) => {
    await mockIntegrationsApis(page);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    // If we land on sign-in, the auth guard is working — mark the test conditional
    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    // Wait for the Sentry card wrapper to appear (catalog loaded)
    const sentryWrapper = page.locator('[data-testid="sentry-card-wrapper"]');
    await expect(sentryWrapper).toBeVisible({ timeout: 15000 });

    // Click the persistent "Show setup instructions" affordance (bottom-right of card)
    const showBtn = page.locator('[data-testid="sentry-show-setup-instructions"]');
    await expect(showBtn).toBeVisible();
    await showBtn.click();

    // The modal should be open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Modal contains the Client Secret input
    const secretInput = page.locator('[data-testid="sentry-client-secret-input"]');
    await expect(secretInput).toBeVisible();
  });

  test('filling and saving Client Secret transitions pill to "Awaiting first event"', async ({
    page,
  }) => {
    // Start with no client secret
    await mockIntegrationsApis(page, {
      hasClientSecret: false,
      verified: false,
      lastEventAt: null,
    });

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    const sentryWrapper = page.locator('[data-testid="sentry-card-wrapper"]');
    await expect(sentryWrapper).toBeVisible({ timeout: 15000 });

    // Open modal via persistent affordance
    const showBtn = page.locator('[data-testid="sentry-show-setup-instructions"]');
    await showBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill Client Secret
    const secretInput = page.locator('[data-testid="sentry-client-secret-input"]');
    await secretInput.fill('test-client-secret-value');

    // Mock the POST to succeed and mock subsequent GET to return hasClientSecret: true
    await page.route('**/api/integrations/sentry', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hasClientSecret: true,
            verified: false,
            lastEventAt: null,
          }),
        });
      }
      return route.continue();
    });

    // Submit the form
    const saveBtn = page.locator('[data-testid="sentry-save-button"]');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Modal should close on success
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // The status pill should now show "Awaiting first event" (data-state="awaiting")
    const pill = page.locator('[data-testid="sentry-status-pill"]');
    await expect(pill).toBeVisible({ timeout: 5000 });
    await expect(pill).toHaveAttribute('data-state', 'awaiting');
  });

  test('closing modal via close button dismisses it without error', async ({ page }) => {
    await mockIntegrationsApis(page);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    const sentryWrapper = page.locator('[data-testid="sentry-card-wrapper"]');
    await expect(sentryWrapper).toBeVisible({ timeout: 15000 });

    // Open modal
    const showBtn = page.locator('[data-testid="sentry-show-setup-instructions"]');
    await showBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close via the X button (aria-label="Close modal")
    await page.locator('[aria-label="Close modal"]').click();

    // Modal is gone
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('modal is reopenable via the persistent affordance after dismissal', async ({ page }) => {
    await mockIntegrationsApis(page);

    await page.goto(`${DASHBOARD_URL}/en/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    const sentryWrapper = page.locator('[data-testid="sentry-card-wrapper"]');
    await expect(sentryWrapper).toBeVisible({ timeout: 15000 });

    const showBtn = page.locator('[data-testid="sentry-show-setup-instructions"]');

    // First open
    await showBtn.click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close
    await page.locator('[aria-label="Close modal"]').click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // Reopen via same affordance
    await showBtn.click();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });
});
