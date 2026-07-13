/**
 * AC-074 — Investigation create is not blocked by credits exhaustion (OSS).
 *
 * Creating incidents through the OSS dashboard never fails with 402
 * CREDITS_EXHAUSTED from the local credits ledger or a commercial quota gate.
 * Metrics omit credit counters; subscription returns 410.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL } from './helpers';

test.describe('AC-074 — no credits gate on incident create', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('creates multiple investigations without 402 CREDITS_EXHAUSTED or credits modal', async ({
    page,
    request,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-074' });
    test.setTimeout(180_000);

    const coreHealth = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(
      coreHealth?.ok,
      `Core API not reachable at ${OSS_CORE_API_URL}/health. Bring up compose Core first.`,
    ).toBeTruthy();

    // Metrics must not expose free-tier credit counters.
    const metricsRes = await request.get('/api/metrics');
    expect(metricsRes.ok()).toBeTruthy();
    const metricsBody = (await metricsRes.json()) as { metrics?: Record<string, unknown> };
    const metrics = metricsBody.metrics ?? {};
    expect(metrics).not.toHaveProperty('creditsTotal');
    expect(metrics).not.toHaveProperty('creditsRemaining');
    expect(metrics).not.toHaveProperty('creditsUsed');

    // Subscription must be Gone — no stub free-plan credit payload.
    const subRes = await request.get('/api/billing/subscription');
    expect(subRes.status()).toBe(410);
    const subBody = (await subRes.json()) as Record<string, unknown>;
    expect(subBody).not.toHaveProperty('creditsTotal');
    expect(subBody).not.toHaveProperty('creditsRemaining');
    expect(subBody).not.toHaveProperty('creditsUsed');

    await page.goto('/dashboard/analyses/new', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });

    const welcome = page.getByRole('dialog', { name: /Welcome, Detective/i });
    try {
      await welcome.waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByRole('button', { name: /Skip Tutorial/i }).click();
      await expect(welcome).toBeHidden({ timeout: 10_000 });
    } catch {
      // Modal not shown — continue.
    }

    await expect(page.getByText(/investigations left/i)).toHaveCount(0);
    await expect(page.getByText(/credits remaining/i)).toHaveCount(0);

    const stamp = Date.now();
    const title = `AC-074 unlimited create ${stamp}`;
    const description =
      'Regression check that OSS incident creation is never blocked by a 3-credit free tier.';

    await page.locator('#incident-title').fill(title);
    await page.locator('#incident-description').fill(description);
    await page.locator('input[name="severity"][value="high"]').evaluate((el) => {
      (el as HTMLInputElement).click();
    });

    const createResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/incidents') && res.request().method() === 'POST',
      { timeout: 60_000 },
    );

    await page.getByRole('button', { name: /create|submit/i }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status(), await createResponse.text()).not.toBe(402);
    expect(createResponse.ok()).toBeTruthy();
    const createBody = (await createResponse.json()) as { code?: string };
    expect(createBody.code).not.toBe('CREDITS_EXHAUSTED');

    await expect(page.getByText(/Credits exhausted/i)).toHaveCount(0);
    await expect(page.getByText(/3 analyses per month/i)).toHaveCount(0);

    // Exhaust the old 3-credit free tier via repeated API creates — all must succeed.
    for (let i = 0; i < 4; i++) {
      const res = await request.post('/api/incidents', {
        data: {
          title: `AC-074 bulk ${stamp} ${i}`,
          description: 'Bulk create to prove no local credits ledger blocks OSS operators.',
          severity: 'medium',
        },
      });
      expect(res.status(), await res.text()).not.toBe(402);
      const body = (await res.json()) as { code?: string };
      expect(body.code).not.toBe('CREDITS_EXHAUSTED');
      expect(res.ok()).toBeTruthy();
    }
  });
});
