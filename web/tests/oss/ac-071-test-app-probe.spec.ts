/**
 * AC-071 — Test Application Test action uses Core stub probe.
 *
 * Pass path:
 * 1. Connect Test Application (OSS) via BFF → Core stub/connect.
 * 2. Click Test on the connected card while causeflow-test-app is healthy.
 * 3. UI reports success; the request uses POST /api/integrations/stub/probe
 *    (Core POST /v1/integrations/stub/probe), not generic test-connection.
 *
 * Not a pass path: POST /api/integrations/test for stub-upstream.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL, OSS_DASHBOARD_URL } from './helpers';

const STUB_UPSTREAM_URL = process.env.OSS_STUB_UPSTREAM_URL || 'http://127.0.0.1:5190';

async function dismissWelcome(page: import('@playwright/test').Page): Promise<void> {
  const welcome = page.getByRole('dialog', { name: /Welcome, Detective/i });
  try {
    await welcome.waitFor({ state: 'visible', timeout: 5_000 });
    await page.getByRole('button', { name: /Skip Tutorial/i }).click();
    await expect(welcome).toBeHidden({ timeout: 10_000 });
  } catch {
    // Modal not shown.
  }
}

test.describe('AC-071 — Test Application uses Core stub probe', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('healthy test app yields successful Test via stub/probe BFF', async ({
    page,
    request,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-071' });
    test.setTimeout(180_000);

    const stubHealth = await fetch(`${STUB_UPSTREAM_URL}/health`).catch(() => null);
    expect(
      stubHealth?.ok,
      `Test application not reachable at ${STUB_UPSTREAM_URL}/health. ` +
        'Bring up causeflow-test-app before running AC-071.',
    ).toBeTruthy();

    const coreHealth = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(coreHealth?.ok, `Core not reachable at ${OSS_CORE_API_URL}/health`).toBeTruthy();

    await page.goto('/dashboard/integrations', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/clerk\./);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    await expect(page.locator('main')).toBeVisible();
    await dismissWelcome(page);

    const testAppCard = page.getByTestId('stub-upstream-card');
    await expect(testAppCard).toBeVisible({ timeout: 30_000 });
    await expect(testAppCard.getByText('Test Application (OSS)')).toBeVisible();

    await testAppCard.getByRole('button', { name: /Connect Test Application/i }).click();
    await expect(testAppCard.getByText('Connected', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    const genericTest = await request.post('/api/integrations/test', {
      data: { type: 'stub-upstream' },
    });
    expect(genericTest.ok()).toBeTruthy();
    const genericBody = (await genericTest.json()) as { success?: boolean; message?: string };
    expect(
      genericBody.success,
      'generic test-connection must not report success for stub-upstream',
    ).toBe(false);
    expect(String(genericBody.message ?? '')).toMatch(/stub\/probe|stub probe/i);

    const probePaths: string[] = [];
    await page.route('**/api/integrations/**', async (route) => {
      probePaths.push(new URL(route.request().url()).pathname);
      await route.continue();
    });

    const testButton = testAppCard.getByRole('button', { name: /Test connection/i });
    await expect(testButton).toBeVisible();
    await testButton.click();

    await expect(
      page.getByText(/Connection to Test Application \(OSS\) succeeded/i),
    ).toBeVisible({ timeout: 30_000 });

    expect(
      probePaths.some((p) => p.includes('/api/integrations/stub/probe')),
      `expected Test to call stub/probe; saw paths: ${probePaths.join(', ')}`,
    ).toBeTruthy();
    expect(
      probePaths.some((p) => p === '/api/integrations/test'),
      'Test must not use generic /api/integrations/test for stub-upstream',
    ).toBeFalsy();

    const probeRes = await request.post('/api/integrations/stub/probe', { data: {} });
    expect(probeRes.ok()).toBeTruthy();
    const probeBody = (await probeRes.json()) as {
      success?: boolean;
      message?: string;
      probedAt?: string;
    };
    expect(probeBody.success).toBe(true);
    expect(String(probeBody.message ?? '')).toMatch(/probe succeeded/i);

    const listRes = await request.get('/api/integrations');
    expect(listRes.ok()).toBeTruthy();
    const listBody = (await listRes.json()) as {
      integrations?: Array<{ provider?: string; type?: string; status?: string }>;
    };
    const stub = (listBody.integrations ?? []).find(
      (i) => i.provider === 'stub-upstream' || i.type === 'stub-upstream',
    );
    expect(stub, 'expected stub-upstream connected after Test').toBeTruthy();
    expect(['active', 'connected']).toContain(String(stub?.status).toLowerCase());

    expect(page.url()).toContain('/dashboard/integrations');
    expect(OSS_DASHBOARD_URL).toBeTruthy();
  });
});
