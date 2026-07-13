/**
 * AC-072 — Unreachable test app shows clear Connect/Test errors.
 *
 * When causeflow-test-app is stopped while dashboard and Core API remain up:
 * - Connect must fail with a clear unreachable/error message and not persist
 *   a connected stub-upstream record.
 * - Test (with a prior connection) must fail with unreachable and must not
 *   update lastTestedAt or show a false healthy state.
 *
 * Not a pass path: generic `/api/integrations/test` or Core test-connection
 * short-circuit success while the test app is down.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL } from './helpers';

// Web compose sets container_name: causeflow-test-app. Core/umbrella compose
// may name the container project_causeflow-test-app_N — override via env.
const TEST_APP_CONTAINER =
  process.env.OSS_TEST_APP_CONTAINER || 'causeflow-test-app';
const STUB_UPSTREAM_URL = process.env.OSS_STUB_UPSTREAM_URL || 'http://127.0.0.1:5190';

async function resolveTestAppContainer(
  execFileAsync: (
    file: string,
    args: string[],
  ) => Promise<{ stdout: string; stderr: string }>,
): Promise<string> {
  try {
    await execFileAsync('docker', ['inspect', '-f', '{{.Id}}', TEST_APP_CONTAINER]);
    return TEST_APP_CONTAINER;
  } catch {
    // Fall through to compose-service label lookup (umbrella naming).
  }
  const { stdout } = await execFileAsync('docker', [
    'ps',
    '-aq',
    '--filter',
    'label=com.docker.compose.service=causeflow-test-app',
  ]);
  const id = stdout
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!id) {
    throw new Error(
      `No causeflow-test-app container found (tried ${TEST_APP_CONTAINER}; set OSS_TEST_APP_CONTAINER)`,
    );
  }
  return id;
}

async function setTestAppRunning(running: boolean): Promise<void> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const container = await resolveTestAppContainer(execFileAsync);
  const action = running ? 'start' : 'stop';
  await execFileAsync('docker', [action, container]);
  if (running) {
    for (let i = 0; i < 30; i++) {
      const health = await fetch(`${STUB_UPSTREAM_URL}/health`).catch(() => null);
      if (health?.ok) return;
      await new Promise((r) => setTimeout(r, 1_000));
    }
    throw new Error(`Test app did not become healthy at ${STUB_UPSTREAM_URL}/health`);
  }
}

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

function stubIntegration(
  integrations: Array<{
    provider?: string;
    type?: string;
    status?: string;
    lastTestedAt?: string;
  }>,
) {
  return integrations.find(
    (i) => i.provider === 'stub-upstream' || i.type === 'stub-upstream',
  );
}

test.describe('AC-072 — unreachable test application', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test.afterAll(async () => {
    await setTestAppRunning(true).catch(() => {
      // Best-effort restore for sibling harness workers.
    });
  });

  test('Connect fails with unreachable and does not persist connected state', async ({
    page,
    request,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-072' });
    test.setTimeout(180_000);

    const coreHealth = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(coreHealth?.ok, `Core not reachable at ${OSS_CORE_API_URL}/health`).toBeTruthy();

    await setTestAppRunning(false);

    await page.goto('/dashboard/integrations', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    await dismissWelcome(page);

    const testAppCard = page.getByTestId('stub-upstream-card');
    await expect(testAppCard).toBeVisible({ timeout: 30_000 });

    const connectButton = testAppCard.getByRole('button', {
      name: /Connect Test Application/i,
    });
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    await expect(page.getByText(/unreachable/i)).toBeVisible({ timeout: 30_000 });
    await expect(testAppCard.getByText('Connected', { exact: true })).toHaveCount(0);

    const listRes = await request.get('/api/integrations');
    expect(listRes.ok()).toBeTruthy();
    const listBody = (await listRes.json()) as {
      integrations?: Array<{ provider?: string; type?: string; status?: string }>;
    };
    const stub = stubIntegration(listBody.integrations ?? []);
    if (stub) {
      expect(['active', 'connected']).not.toContain(String(stub.status).toLowerCase());
    }

    const connectRes = await request.post('/api/integrations/stub/connect', {
      data: {},
    });
    expect(connectRes.status()).toBeGreaterThanOrEqual(400);
    const connectBody = (await connectRes.json()) as { error?: string };
    expect(String(connectBody.error ?? '')).toMatch(/unreachable/i);
  });

  test('Test fails with unreachable and does not update lastTestedAt', async ({
    page,
    request,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-072' });
    test.setTimeout(180_000);

    await setTestAppRunning(true);

    const connectRes = await request.post('/api/integrations/stub/connect', { data: {} });
    expect(
      connectRes.ok(),
      `stub connect failed while test app healthy: ${connectRes.status()} ${await connectRes.text()}`,
    ).toBeTruthy();

    const listBefore = await request.get('/api/integrations');
    expect(listBefore.ok()).toBeTruthy();
    const beforeBody = (await listBefore.json()) as {
      integrations?: Array<{ provider?: string; type?: string; lastTestedAt?: string }>;
    };
    const stubBefore = stubIntegration(beforeBody.integrations ?? []);
    expect(stubBefore, 'expected stub-upstream connected before Test scenario').toBeTruthy();
    const lastTestedBefore = stubBefore?.lastTestedAt;

    await setTestAppRunning(false);

    await page.goto('/dashboard/integrations', { waitUntil: 'domcontentloaded' });
    await dismissWelcome(page);

    const testAppCard = page.getByTestId('stub-upstream-card');
    await expect(testAppCard.getByText('Connected', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    const testButton = testAppCard.getByRole('button', { name: /Test connection/i });
    await expect(testButton).toBeVisible();
    await testButton.click();

    await expect(page.getByText(/unreachable/i)).toBeVisible({ timeout: 30_000 });

    const probeRes = await request.post('/api/integrations/stub/probe', { data: {} });
    expect(probeRes.ok()).toBeTruthy();
    const probeBody = (await probeRes.json()) as { success?: boolean; message?: string };
    expect(probeBody.success).toBe(false);
    expect(String(probeBody.message ?? '')).toMatch(/unreachable/i);

    const listAfter = await request.get('/api/integrations');
    expect(listAfter.ok()).toBeTruthy();
    const afterBody = (await listAfter.json()) as {
      integrations?: Array<{ provider?: string; type?: string; lastTestedAt?: string }>;
    };
    const stubAfter = stubIntegration(afterBody.integrations ?? []);
    expect(stubAfter?.lastTestedAt ?? undefined).toBe(lastTestedBefore ?? undefined);
  });
});
