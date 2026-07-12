/**
 * AC-058 — Connect Core runnable test application + enable additional connector.
 *
 * Pass path:
 * 1. Connect Test Application (OSS) via BFF → Core `POST /v1/integrations/stub/connect`
 *    → Core-owned causeflow-test-app on :5190.
 * 2. Enable Datadog (OSS stub) via BFF → Core `POST /v1/integrations/stub/enable`.
 * 3. Reload: both show Connected; `GET /api/integrations` returns both records.
 *
 * Not a pass path: Playwright `page.route` mocks of `/api/integrations/*`, Composio.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL } from './helpers';

const STUB_UPSTREAM_URL = process.env.OSS_STUB_UPSTREAM_URL || 'http://127.0.0.1:5190';

test.describe('AC-058 — test application + additional connector', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('connects test app and enables Datadog stub against it', async ({ page, request }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-058' });
    test.setTimeout(180_000);

    const stubHealth = await fetch(`${STUB_UPSTREAM_URL}/health`).catch(() => null);
    expect(
      stubHealth?.ok,
      `Test application not reachable at ${STUB_UPSTREAM_URL}/health. ` +
        'Bring up causeflow-test-app (Core compose) before running AC-058.',
    ).toBeTruthy();

    const stubStateBefore = (await (await fetch(`${STUB_UPSTREAM_URL}/v1/state`)).json()) as {
      connections?: unknown[];
    };
    const connectionsBefore = Array.isArray(stubStateBefore.connections)
      ? stubStateBefore.connections.length
      : 0;

    await page.goto('/dashboard/integrations', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/clerk\./);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    await expect(page.locator('main')).toBeVisible();

    const welcome = page.getByRole('dialog', { name: /Welcome, Detective/i });
    try {
      await welcome.waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByRole('button', { name: /Skip Tutorial/i }).click();
      await expect(welcome).toBeHidden({ timeout: 10_000 });
    } catch {
      // Modal not shown for this tenant — continue.
    }

    // Step 1 — Connect the Core-owned runnable test application.
    const testAppCard = page.getByTestId('stub-upstream-card');
    await expect(testAppCard).toBeVisible({ timeout: 30_000 });
    await expect(testAppCard.getByText('Test Application (OSS)')).toBeVisible();
    await testAppCard.getByRole('button', { name: /Connect Test Application/i }).click();
    await expect(testAppCard.getByText('Connected', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    const stubStateAfterConnect = (await (await fetch(`${STUB_UPSTREAM_URL}/v1/state`)).json()) as {
      connections?: unknown[];
      app?: string;
    };
    expect(stubStateAfterConnect.app).toBe('causeflow-test-app');
    const connectionsAfter = Array.isArray(stubStateAfterConnect.connections)
      ? stubStateAfterConnect.connections.length
      : 0;
    expect(connectionsAfter).toBeGreaterThan(connectionsBefore);

    // Step 2 — Enable an additional connector (Datadog) against that test app.
    const datadogCard = page.getByTestId('stub-datadog-card');
    await expect(datadogCard).toBeVisible({ timeout: 15_000 });
    await expect(datadogCard.getByText('Datadog (OSS stub)')).toBeVisible();
    await datadogCard.getByRole('button', { name: /Connect Datadog/i }).click();
    await expect(datadogCard.getByText('Connected', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // Step 3 — Reload: both remain enabled; Core/BFF list confirms both records.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByTestId('stub-upstream-card').getByText('Connected', { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByTestId('stub-datadog-card').getByText('Connected', { exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    const listRes = await request.get('/api/integrations');
    expect(listRes.ok(), `GET /api/integrations failed: ${listRes.status()}`).toBeTruthy();
    const listBody = (await listRes.json()) as {
      integrations?: Array<{ provider?: string; type?: string; status?: string }>;
    };
    const integrations = listBody.integrations ?? [];

    const stub = integrations.find(
      (i) => i.provider === 'stub-upstream' || i.type === 'stub-upstream',
    );
    expect(stub, 'expected stub-upstream (test application) in integrations list').toBeTruthy();
    expect(['active', 'connected']).toContain(String(stub?.status).toLowerCase());

    const datadog = integrations.find((i) => i.provider === 'datadog' || i.type === 'datadog');
    expect(datadog, 'expected datadog stub connector in integrations list').toBeTruthy();
    expect(['active', 'connected']).toContain(String(datadog?.status).toLowerCase());

    const coreHealth = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(coreHealth?.ok, `Core not reachable at ${OSS_CORE_API_URL}/health`).toBeTruthy();
  });
});
