/**
 * AC-055 — Connect a Core OSS/stub connector (scaffold for WI-AC-055).
 *
 * Pass path: real Core stub integration API via the dashboard BFF.
 * Not a pass path: Playwright `page.route` mocks of `/api/integrations/*`.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers } from './helpers';

test.describe('AC-055 — Core stub connector connect', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('opens integrations with Core local session (no BFF page.route mock)', async ({ page }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-055' });

    await page.goto('/dashboard/integrations', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/clerk\./);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);

    // Catalog / connect flow against Core stubs is implemented in WI-AC-055.
    // This scaffold keeps the AC discoverable via
    // `pnpm exec playwright test --project=dashboard-oss-e2e --list`.
    await expect(page.locator('main')).toBeVisible();
  });
});
