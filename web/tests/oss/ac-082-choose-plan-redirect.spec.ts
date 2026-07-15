/**
 * AC-082 — Bookmarked choose-plan redirects away in OSS.
 *
 * Direct navigation to /onboarding/choose-plan must redirect to /dashboard
 * (or the next non-plan onboarding step) and never render commercial plan cards.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers } from './helpers';

test.describe('AC-082 — bookmarked choose-plan redirects away', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('direct navigation to choose-plan redirects to dashboard without plan cards', async ({
    page,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-082' });
    test.setTimeout(90_000);

    const stamp = Date.now();
    const email = `ac082-${stamp}@causeflow.local`;
    const password = `Ac082-${stamp}-Pw!`;
    const name = 'AC-082 User';
    const tenantName = `AC082 Tenant ${stamp}`;

    const register = await page.request.post('/api/auth/register', {
      data: { name, email, password, tenantName },
    });
    expect(register.ok()).toBeTruthy();

    await page.goto('/onboarding/choose-plan', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/onboarding\/choose-plan/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });

    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/\bStarter\b/i);
    expect(body).not.toMatch(/\bBusiness\b/i);
    expect(body).not.toMatch(/start trial/i);
  });
});
