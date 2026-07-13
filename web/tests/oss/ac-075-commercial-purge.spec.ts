/**
 * AC-075 — Commercial billing checkout/portal clients removed; marketing OSS CTAs.
 */
import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL } from './helpers';

const OSS_WEBSITE_URL = process.env.OSS_WEBSITE_URL || 'http://127.0.0.1:3000';

test.describe('AC-075 — commercial billing purge', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('dashboard billing checkout/portal return 410; pricing shows self-host CTAs', async ({
    page,
    request,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-075' });

    const coreHealth = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(
      coreHealth?.ok,
      `Core API not reachable at ${OSS_CORE_API_URL}/health. Bring up compose Core first.`,
    ).toBeTruthy();

    const checkoutRes = await request.post('/api/billing/checkout', {
      data: { planId: 'starter', from: 'billing' },
    });
    expect(checkoutRes.status()).toBe(410);
    const checkoutBody = (await checkoutRes.json()) as { error?: string };
    expect(checkoutBody.error ?? '').toMatch(/billing is disabled/i);

    const portalRes = await request.post('/api/billing/portal', { data: {} });
    expect(portalRes.status()).toBe(410);
    const portalBody = (await portalRes.json()) as { error?: string };
    expect(portalBody.error ?? '').toMatch(/billing is disabled/i);

    const coreCheckout = await fetch(`${OSS_CORE_API_URL}/v1/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planKey: 'starter',
        successUrl: 'http://localhost/success',
        cancelUrl: 'http://localhost/cancel',
      }),
    }).catch(() => null);
    if (coreCheckout) {
      expect([404, 410]).toContain(coreCheckout.status);
    }

    await page.goto(`${OSS_WEBSITE_URL}/pricing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/open-source|self-host/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /^Self-host$/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /view on github/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /create account/i })).toHaveCount(0);
    await expect(page.locator('a[href*="stripe.com"]')).toHaveCount(0);
    await expect(page.locator('a[href*="/sign-up"]')).toHaveCount(0);
  });
});
