/**
 * AC-081 — OSS onboarding skips plan selection after org bootstrap.
 *
 * After sign-up (tenant provisioned on Core) or visiting create-organization,
 * users land on /dashboard — never on /onboarding/choose-plan as a gate.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers } from './helpers';

test.describe('AC-081 — post-org onboarding skips choose-plan', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('fresh register reaches dashboard without choose-plan gate', async ({ page }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-081' });
    test.setTimeout(90_000);

    const stamp = Date.now();
    const email = `ac081-${stamp}@causeflow.local`;
    const password = `Ac081-${stamp}-Pw!`;
    const name = 'AC-081 Signup User';
    const tenantName = `AC081 Tenant ${stamp}`;

    const register = await page.request.post('/api/auth/register', {
      data: { name, email, password, tenantName },
    });
    expect(register.ok()).toBeTruthy();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/\/onboarding\/choose-plan/);
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });

    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/Starter/i);
    expect(body).not.toMatch(/start trial/i);
  });

  test('create-organization redirects to dashboard, not choose-plan', async ({ page }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-081' });
    test.setTimeout(90_000);

    const stamp = Date.now();
    const email = `ac081-org-${stamp}@causeflow.local`;
    const password = `Ac081-${stamp}-Pw!`;
    const name = 'AC-081 Org User';
    const tenantName = `AC081 Tenant ${stamp}`;

    const register = await page.request.post('/api/auth/register', {
      data: { name, email, password, tenantName },
    });
    expect(register.ok()).toBeTruthy();

    await page.goto('/create-organization', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/\/onboarding\/choose-plan/);
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
  });
});
