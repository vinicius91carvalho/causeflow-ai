/**
 * AC-075 — Commercial billing checkout/portal clients removed; marketing OSS CTAs.
 * Root AC-003 — /pricing routes hard-removed (404).
 */
import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL } from './helpers';

const OSS_WEBSITE_URL = process.env.OSS_WEBSITE_URL || 'http://127.0.0.1:3000';

test.describe('AC-075 — commercial billing purge', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('dashboard billing checkout/portal return 410; pricing returns 404', async ({
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

    for (const path of ['/pricing', '/pt-br/pricing'] as const) {
      const pricingRes = await fetch(`${OSS_WEBSITE_URL}${path}`, { redirect: 'manual' });
      expect(pricingRes.status, `${path} should be hard-removed`).toBe(404);
      expect(pricingRes.headers.get('location')).toBeNull();
    }

    await page.goto(`${OSS_WEBSITE_URL}/pricing`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/\$99|\$349|\$899/)).toHaveCount(0);
  });
});
