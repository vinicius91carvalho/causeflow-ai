/**
 * AC-056 — Create a real incident Core persists; detail page shows live SSE progress.
 *
 * Pass path: authenticated POST through the dashboard BFF into Core; Core
 * Postgres row; detail page EventSource → `/api/incidents/:id/stream` proxies
 * Core `/v1/investigation/:id/stream` (text/event-stream) with real progress.
 *
 * Not a pass path: Playwright `page.route` mocks of `/api/incidents*`.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL } from './helpers';

test.describe('AC-056 — Core-persisted incident create + live SSE', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('creates Core incident and shows live investigation SSE progress', async ({
    page,
    request,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-056' });
    test.setTimeout(180_000);

    const coreHealth = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(
      coreHealth?.ok,
      `Core API not reachable at ${OSS_CORE_API_URL}/health. Bring up compose Core first.`,
    ).toBeTruthy();

    await page.goto('/dashboard/analyses', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/clerk\./);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    await expect(page.locator('main')).toBeVisible();

    // Fresh OSS tenants may see the welcome/onboarding modal.
    const welcome = page.getByRole('dialog', { name: /Welcome, Detective/i });
    try {
      await welcome.waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByRole('button', { name: /Skip Tutorial/i }).click();
      await expect(welcome).toBeHidden({ timeout: 10_000 });
    } catch {
      // Modal not shown — continue.
    }

    const stamp = Date.now();
    const title = `AC-056 checkout latency ${stamp}`;
    const description =
      'p99 latency on checkout exceeded two seconds for five continuous minutes during peak traffic.';

    // Step 1: create via dashboard BFF (credits ledger + Core POST /v1/incidents/chat).
    const createRes = await request.post('/api/incidents', {
      data: { title, description, severity: 'high' },
    });
    expect(
      createRes.ok(),
      `POST /api/incidents failed: ${createRes.status()} ${await createRes.text()}`,
    ).toBeTruthy();
    expect(createRes.status()).toBe(201);

    const createBody = (await createRes.json()) as {
      incidentId?: string;
      status?: string;
      incident?: { incidentId?: string };
    };
    const incidentId = createBody.incidentId ?? createBody.incident?.incidentId;
    expect(incidentId, 'expected incidentId from BFF create').toBeTruthy();

    // Confirm Core persistence via BFF detail read (same tenant session).
    const detailRes = await request.get(`/api/analyses/${incidentId}`);
    expect(
      detailRes.ok(),
      `GET /api/analyses/${incidentId} failed: ${detailRes.status()} ${await detailRes.text()}`,
    ).toBeTruthy();
    const detailBody = (await detailRes.json()) as {
      incident?: { incidentId?: string; title?: string; status?: string; severity?: string };
      incidentId?: string;
    };
    const persistedId = detailBody.incident?.incidentId ?? detailBody.incidentId;
    expect(persistedId).toBe(incidentId);
    expect(detailBody.incident?.title ?? title).toContain('AC-056');

    // Step 2–3: open detail; assert live SSE + non-empty Core-sourced progress in UI.
    const streamPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/incidents/${incidentId}/stream`) &&
        res.headers()['content-type']?.includes('text/event-stream') === true,
      { timeout: 60_000 },
    );

    await page.goto(`/dashboard/incidents/${incidentId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 30_000 });

    const streamRes = await streamPromise;
    expect(streamRes.status()).toBe(200);
    expect(streamRes.headers()['content-type']).toMatch(/text\/event-stream/);

    // Status / severity from Core (not Playwright fixture JSON).
    await expect(page.getByText(/triaging|investigating|awaiting|resolved/i).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/high/i).first()).toBeVisible();

    // Live SSE progress line (replay or live investigation_progress from Core).
    const progress = page.getByTestId('incident-sse-progress');
    await expect(progress).toBeVisible({ timeout: 90_000 });
    await expect(progress).not.toHaveText('');
    await expect(progress).toContainText(
      /Live investigation stream connected|Investigation|Agent|Wave|Synthesiz|started|progress|completed/i,
      { timeout: 90_000 },
    );
  });
});
