/**
 * AC-083 — OSS onboarding and settings surfaces have no paid-plan selection copy.
 *
 * Post-signup onboarding tutorial and settings must not instruct users to select
 * a paid plan, upgrade a plan, or complete plan checkout.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers } from './helpers';

const PLAN_COPY = /upgrade.*plan|choose.*plan|select.*plan|paid plan|start trial|checkout/i;

test.describe('AC-083 — no paid-plan selection copy in onboarding/settings', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('onboarding tutorial and settings omit plan-selection instructions', async ({ page }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-083' });
    test.setTimeout(90_000);

    const stamp = Date.now();
    const email = `ac083-${stamp}@causeflow.local`;
    const password = `Ac083-${stamp}-Pw!`;
    const name = 'AC-083 User';
    const tenantName = `AC083 Tenant ${stamp}`;

    const register = await page.request.post('/api/auth/register', {
      data: { name, email, password, tenantName },
    });
    expect(register.ok()).toBeTruthy();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });

    const modal = page.locator('.onboarding-modal__card');
    await expect(modal).toBeVisible({ timeout: 15_000 });

    const maxSteps = 8;
    for (let i = 0; i < maxSteps; i += 1) {
      await expect(modal).toBeVisible();
      const dialogText = await modal.innerText();
      expect(dialogText).not.toMatch(PLAN_COPY);
      expect(dialogText).not.toMatch(/Credits & Plans/i);

      const finish = modal.getByRole('button', { name: /Get Started/i });
      if (await finish.isVisible()) {
        await finish.click();
        break;
      }
      const nextButton = modal.getByRole('button', { name: /Next|Let's Go/i });
      await nextButton.click();
    }

    await expect(modal).toBeHidden({ timeout: 10_000 });

    await page.goto('/onboarding/welcome', { waitUntil: 'domcontentloaded' });
    const welcomePageBody = await page.locator('main').innerText();
    expect(welcomePageBody).not.toMatch(/Choose Your Plan/i);
    expect(welcomePageBody).not.toMatch(PLAN_COPY);

    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    const settingsBody = await page.locator('main').innerText();
    expect(settingsBody).not.toMatch(PLAN_COPY);
    expect(settingsBody).not.toMatch(/Current Plan/i);
    expect(settingsBody).not.toMatch(/Upgrade Plan/i);
  });
});
