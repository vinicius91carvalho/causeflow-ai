/**
 * Sprint 05 — Fire Test Error button round-trip E2E spec.
 *
 * Verifies the full AD-7 flow:
 *   1. "Fire Test Error" button is visible on the settings page.
 *   2. Clicking it calls POST /api/admin/fire-test-errors.
 *   3. The Core API intentionally returns HTTP 500 + { error: 'TestErrorFired', traceId }.
 *      The dashboard treats this as SUCCESS (AD-7 contract).
 *   4. The UI shows the traceId below the button.
 *   5. (Staging only) Poll GET /api/integrations/sentry until verified === true,
 *      confirming the webhook round-trip fired an incident in the Core API.
 *
 * GATE: This spec only runs when E2E_TARGET=staging.
 * Locally it is always skipped — the round-trip requires a live Core API,
 * a registered Sentry Internal Integration, and a real webhook delivery.
 *
 * Uses API mocks for assertions 1-4 (button visibility, AD-7 success parsing, traceId display).
 * Assertion 5 is unskipped only on staging (process.env.E2E_TARGET === 'staging').
 */

import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Fire Test Error — AD-7 contract and round-trip', () => {
  // All tests in this describe block are gated to staging only.
  // The test.skip at the describe level is evaluated once before any test runs.
  test.skip(
    process.env.E2E_TARGET !== 'staging',
    'Round-trip spec only runs when E2E_TARGET=staging — skipped in local/CI without a live Core API',
  );

  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('Fire Test Error button is visible on settings page', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/en/dashboard/settings`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });

    // The card heading
    await expect(page.getByText('Fire Test Sentry Error')).toBeVisible({ timeout: 10000 });

    // The button itself (located by text, no data-testid on this element)
    const fireBtn = page.getByRole('button', { name: 'Fire Test Error' });
    await expect(fireBtn).toBeVisible();
    await expect(fireBtn).toBeEnabled();
  });

  test('AD-7: clicking Fire Test Error shows traceId when Core API returns 500+TestErrorFired', async ({
    page,
  }) => {
    const testTraceId = 'staging-trace-abc123';

    await page.goto(`${DASHBOARD_URL}/en/dashboard/settings`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });

    // Mock the fire-test-errors endpoint to return the AD-7 intentional 500 response
    await page.route('**/api/admin/fire-test-errors', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'TestErrorFired', traceId: testTraceId }),
        });
      }
      return route.continue();
    });

    const fireBtn = page.getByRole('button', { name: 'Fire Test Error' });
    await expect(fireBtn).toBeVisible({ timeout: 10000 });
    await fireBtn.click();

    // After firing, the button transitions back to "Fire Test Error" (not loading)
    // and the traceId appears below
    await expect(page.getByText('Firing errors...')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(testTraceId)).toBeVisible({ timeout: 5000 });

    // The full "Last fired: trace <traceId>" paragraph should be rendered
    await expect(page.locator(`text=Last fired: trace`)).toBeVisible();
  });

  test('AD-7 round-trip: fire error then poll Sentry status until verified (staging only)', async ({
    page,
  }) => {
    // This test requires:
    // - E2E_TARGET=staging (enforced by the describe-level skip above)
    // - A real Sentry Internal Integration registered with the Core API
    // - The Core API to process the fired event and set verified=true on the integration

    await page.goto(`${DASHBOARD_URL}/en/dashboard/settings`, {
      waitUntil: 'domcontentloaded',
    });

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Dashboard requires auth — test needs Clerk session from auth-setup');
      return;
    }

    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });

    // Step 1: Click the real Fire Test Error button (no mock — real Core API call)
    const fireBtn = page.getByRole('button', { name: 'Fire Test Error' });
    await expect(fireBtn).toBeVisible({ timeout: 10000 });
    await fireBtn.click();

    // Step 2: Wait for the button to finish loading
    await expect(fireBtn).toBeEnabled({ timeout: 15000 });

    // Step 3: Expect the traceId paragraph to appear (AD-7 success parse worked)
    await expect(page.locator('text=Last fired: trace')).toBeVisible({ timeout: 10000 });

    // Step 4: Poll GET /api/integrations/sentry until verified === true
    // The webhook from Sentry → Core API may take up to 30 seconds in staging.
    // We poll via the dashboard API (BFF) not the Core API directly.
    await expect
      .poll(
        async () => {
          const response = await page.request.get(`${DASHBOARD_URL}/api/integrations/sentry`);
          if (!response.ok()) return null;
          const body = (await response.json()) as {
            hasClientSecret: boolean;
            verified: boolean;
            lastEventAt: string | null;
          };
          return body.verified;
        },
        {
          message:
            'Sentry integration should report verified=true within 60 seconds after firing a test error',
          timeout: 60_000, // 60 seconds
          intervals: [3_000], // 3 second intervals
        },
      )
      .toBe(true);
  });
});
