/**
 * AC-056 — Create a real incident Core persists (scaffold for WI-AC-056).
 *
 * Pass path: authenticated POST through the dashboard BFF into Core.
 * Not a pass path: Playwright `page.route` mocks of `/api/incidents*`.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers } from './helpers';

test.describe('AC-056 — Core-persisted incident create', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('opens analyses with Core local session (no incidents page.route mock)', async ({
    page,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-056' });

    await page.goto('/dashboard/analyses', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/clerk\./);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);

    // Incident create + SSE progress against Core is implemented in WI-AC-056.
    await expect(page.locator('main')).toBeVisible();
  });
});
