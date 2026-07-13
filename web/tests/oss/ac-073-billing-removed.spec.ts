/**
 * AC-073 — Dashboard billing UI and credits chrome are fully removed (OSS).
 *
 * Sidebar/nav has no Billing entry and no "investigations left" / credits
 * remaining chrome. Visiting /dashboard/billing redirects to /dashboard and
 * never renders plan cards, quota packs, Buy more, invoices, or payment modals.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers } from './helpers';

test.describe('AC-073 — billing UI and credits chrome removed', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('sidebar has no Billing or investigations-left chrome; /dashboard/billing redirects', async ({
    page,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-073' });
    test.setTimeout(90_000);

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });

    // Dismiss onboarding tutorial if present (fresh tenants).
    const welcome = page.getByRole('dialog', { name: /Welcome, Detective/i });
    try {
      await welcome.waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByRole('button', { name: /Skip Tutorial/i }).click();
      await expect(welcome).toBeHidden({ timeout: 10_000 });
    } catch {
      // Modal not shown — continue.
    }

    // Sidebar uses data-tour on each nav link (aside may be off-canvas on narrow viewports).
    await expect(page.locator('[data-tour="nav-overview"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-tour="nav-billing"]')).toHaveCount(0);
    await expect(page.locator('a[href="/dashboard/billing"]')).toHaveCount(0);
    await expect(page.getByText(/investigations left/i)).toHaveCount(0);

    await page.goto('/dashboard/billing', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/dashboard\/billing/);

    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/Buy more/i);
    expect(body).not.toMatch(/quota pack/i);
    expect(body).not.toMatch(/Billing disabled in OSS build/i);
    expect(body).not.toMatch(/investigations left/i);
  });
});
