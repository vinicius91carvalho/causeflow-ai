/**
 * AC-055 — Connect a Core OSS/stub connector against the real stub upstream.
 *
 * Pass path: dashboard BFF → Core `POST /v1/integrations/stub/connect` →
 * Core-owned test-app / stub-upstream on :5190. UI shows Connected; Core
 * `GET /v1/integrations` confirms the stub-upstream record for the tenant.
 *
 * Not a pass path: Playwright `page.route` mocks of `/api/integrations/*`.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL } from './helpers';

const STUB_UPSTREAM_URL = process.env.OSS_STUB_UPSTREAM_URL || 'http://127.0.0.1:5190';

test.describe('AC-055 — Core stub connector connect', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('connects stub-upstream via Core stub API (no BFF page.route mock)', async ({
    page,
    request,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-055' });
    test.setTimeout(120_000);

    // Fail closed if Core stub upstream is down — must be a real Core-owned app.
    const stubHealth = await fetch(`${STUB_UPSTREAM_URL}/health`).catch(() => null);
    expect(
      stubHealth?.ok,
      `Stub upstream not reachable at ${STUB_UPSTREAM_URL}/health. ` +
        'Bring up causeflow-test-app (Core compose) before running AC-055.',
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

    // Fresh OSS tenants may see the welcome/onboarding modal over the page.
    // Wait briefly for it; dismiss via Skip Tutorial (always present).
    const welcome = page.getByRole('dialog', { name: /Welcome, Detective/i });
    try {
      await welcome.waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByRole('button', { name: /Skip Tutorial/i }).click();
      await expect(welcome).toBeHidden({ timeout: 10_000 });
    } catch {
      // Modal not shown for this tenant — continue.
    }

    const stubCard = page.getByTestId('stub-upstream-card');
    await expect(stubCard).toBeVisible({ timeout: 30_000 });
    await expect(stubCard.getByText('Stub Upstream (OSS)')).toBeVisible();

    // Connect against Core stub — real network to BFF → Core → stub upstream.
    await stubCard.getByRole('button', { name: /Connect Stub Upstream/i }).click();

    // UI shows connected/ready after Core persists the stub record.
    await expect(stubCard.getByText('Connected', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // Stub upstream received the connection (not a Playwright fake).
    const stubStateAfter = (await (await fetch(`${STUB_UPSTREAM_URL}/v1/state`)).json()) as {
      connections?: unknown[];
    };
    const connectionsAfter = Array.isArray(stubStateAfter.connections)
      ? stubStateAfter.connections.length
      : 0;
    expect(
      connectionsAfter,
      'expected stub upstream /v1/state connections to grow after Connect',
    ).toBeGreaterThan(connectionsBefore);

    // Reload UI still reflects connected state.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByTestId('stub-upstream-card').getByText('Connected', { exact: true }),
    ).toBeVisible({
      timeout: 30_000,
    });

    // Core API read confirms the stub connection record for the tenant.
    // Prefer dashboard BFF (session cookie) so we do not mint JWTs in the test.
    const listRes = await request.get('/api/integrations');
    expect(listRes.ok(), `GET /api/integrations failed: ${listRes.status()}`).toBeTruthy();
    const listBody = (await listRes.json()) as {
      integrations?: Array<{ provider?: string; type?: string; status?: string }>;
    };
    const stub = (listBody.integrations ?? []).find(
      (i) => i.provider === 'stub-upstream' || i.type === 'stub-upstream',
    );
    expect(stub, 'expected stub-upstream in dashboard integrations list').toBeTruthy();
    expect(['active', 'connected']).toContain(String(stub?.status).toLowerCase());

    // Optional direct Core health sanity (compose host port).
    const coreHealth = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(coreHealth?.ok, `Core not reachable at ${OSS_CORE_API_URL}/health`).toBeTruthy();
  });
});
