/**
 * AC-061 — Capstone OSS Playwright suite (Goal Review / run_completed gate).
 *
 * One end-to-end scenario that chains AC-054..AC-060 against compose Core:
 *   local auth → connect test app → enable integrations → configure
 *   Ornith/DeepSeek → create incident → analyses/triage/chat/root-cause/remediation.
 *
 * Pass path: Core local JWT (storageState from auth-setup), Core stub/test-app,
 * live Ornith (or approved DeepSeek config path), real BFF → Core calls.
 * Not a pass path: Clerk/.env.staging, page.route BFF mocks, DeterministicLLMClient,
 * partial AC-055/057 smoke alone.
 *
 * Goal Review command:
 *   pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-061-capstone.spec.ts
 */

import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL, OSS_ORNITH_BASE_URL, OSS_ORNITH_MODEL } from './helpers';

const STUB_UPSTREAM_URL = process.env.OSS_STUB_UPSTREAM_URL || 'http://127.0.0.1:5190';

type LlmConnectorResponse = {
  active?: {
    id?: string;
    model?: string;
    baseUrl?: string;
    credentialsConfigured?: boolean;
  };
  options?: Array<{ id?: string; model?: string; credentialsConfigured?: boolean }>;
  contextOverflowCode?: string;
};

type InvestigationDetailBody = {
  incident?: {
    incidentId?: string;
    status?: string;
    severity?: string;
    title?: string;
    rootCause?: string;
  };
  evidenceByAgent?: Record<string, Array<{ content?: string; metadata?: Record<string, string> }>>;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function isBogusRootCause(rootCause: string): boolean {
  return (
    /DeterministicLLMClient/i.test(rootCause) ||
    /Unable to determine root cause \(LLM service unavailable\)/i.test(rootCause) ||
    /Circuit breaker is open/i.test(rootCause) ||
    /Investigation failed/i.test(rootCause) ||
    /Local LLM connector unavailable/i.test(rootCause)
  );
}

/** Poll a BFF GET, retrying Core RATE_LIMIT (429) / transient 5xx. */
async function pollOk(
  request: import('@playwright/test').APIRequestContext,
  path: string,
  maxAttempts = 12,
): Promise<import('@playwright/test').APIResponse> {
  let last: import('@playwright/test').APIResponse | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    last = await request.get(path);
    if (last.ok()) return last;
    if (last.status() === 429 || last.status() >= 500) {
      await sleep(i < 3 ? 5_000 : 15_000);
      continue;
    }
    return last;
  }
  return last as import('@playwright/test').APIResponse;
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

test.describe('AC-061 — capstone golden path (AC-054..AC-060 chain)', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('chains local auth → test app → integrations → LLM → incident → triage/chat/RCA/remediation', async ({
    page,
    request,
  }) => {
    test.info().annotations.push(
      { type: 'acceptance', description: 'AC-061' },
      { type: 'acceptance', description: 'AC-054' },
      { type: 'acceptance', description: 'AC-058' },
      { type: 'acceptance', description: 'AC-059' },
      { type: 'acceptance', description: 'AC-060' },
    );
    // Full chain: connect + LLM switch + Ornith investigation can take several minutes.
    test.setTimeout(720_000);

    // --- Preconditions: compose Core + test app + Ornith ---
    const stubHealth = await fetch(`${STUB_UPSTREAM_URL}/health`).catch(() => null);
    expect(
      stubHealth?.ok,
      `Test application not reachable at ${STUB_UPSTREAM_URL}/health`,
    ).toBeTruthy();

    const ornith = await fetch(`${OSS_ORNITH_BASE_URL}/models`).catch(() => null);
    expect(ornith?.ok, `Ornith not reachable at ${OSS_ORNITH_BASE_URL}/models`).toBeTruthy();

    const coreHealth = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(coreHealth?.ok, `Core not reachable at ${OSS_CORE_API_URL}/health`).toBeTruthy();
    if (!coreHealth) throw new Error('Core /health unreachable');
    const healthJson = (await coreHealth.json()) as Record<string, string>;
    expect(healthJson.llm, `Core llm must be ok; got ${JSON.stringify(healthJson)}`).toBe('ok');

    // --- Stage AC-054: local auth session (storageState from dashboard-oss-setup) ---
    await page.goto('/dashboard/analyses', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/clerk\./);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
    await dismissWelcome(page);

    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === '__session');
    expect(session?.value, 'expected __session JWT from Core local auth setup').toBeTruthy();

    // --- Stage AC-058: connect test app + enable Datadog stub ---
    const listBefore = await request.get('/api/integrations');
    expect(listBefore.ok()).toBeTruthy();
    const beforeBody = (await listBefore.json()) as {
      integrations?: Array<{ provider?: string; type?: string; status?: string }>;
    };
    const before = beforeBody.integrations ?? [];
    const hasStub = before.some(
      (i) =>
        (i.provider === 'stub-upstream' || i.type === 'stub-upstream') &&
        ['active', 'connected'].includes(String(i.status).toLowerCase()),
    );
    const hasDatadog = before.some(
      (i) =>
        (i.provider === 'datadog' || i.type === 'datadog') &&
        ['active', 'connected'].includes(String(i.status).toLowerCase()),
    );

    await page.goto('/dashboard/integrations', { waitUntil: 'domcontentloaded' });
    await dismissWelcome(page);

    if (!hasStub) {
      const testAppCard = page.getByTestId('stub-upstream-card');
      await expect(testAppCard).toBeVisible({ timeout: 30_000 });
      await testAppCard.getByRole('button', { name: /Connect Test Application/i }).click();
      await expect(testAppCard.getByText('Connected', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
    }
    if (!hasDatadog) {
      const datadogCard = page.getByTestId('stub-datadog-card');
      await expect(datadogCard).toBeVisible({ timeout: 15_000 });
      await datadogCard.getByRole('button', { name: /Connect Datadog/i }).click();
      await expect(datadogCard.getByText('Connected', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('stub-upstream-card').getByText('Connected', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('stub-datadog-card').getByText('Connected', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    const listAfter = await request.get('/api/integrations');
    expect(listAfter.ok()).toBeTruthy();
    const afterBody = (await listAfter.json()) as {
      integrations?: Array<{ provider?: string; type?: string; status?: string }>;
    };
    const after = afterBody.integrations ?? [];
    expect(
      after.some(
        (i) =>
          (i.provider === 'stub-upstream' || i.type === 'stub-upstream') &&
          ['active', 'connected'].includes(String(i.status).toLowerCase()),
      ),
      'Core must persist stub-upstream connection',
    ).toBeTruthy();
    expect(
      after.some(
        (i) =>
          (i.provider === 'datadog' || i.type === 'datadog') &&
          ['active', 'connected'].includes(String(i.status).toLowerCase()),
      ),
      'Core must persist datadog stub connection',
    ).toBeTruthy();

    // --- Stage AC-059: configure Ornith default, prove DeepSeek switch, restore Ornith ---
    const reset = await request.put('/api/settings/llm-connector', {
      data: { connector: 'ornith' },
    });
    expect(reset.ok(), `reset ornith failed: ${reset.status()} ${await reset.text()}`).toBeTruthy();

    const connectorRes = await request.get('/api/settings/llm-connector');
    expect(connectorRes.ok()).toBeTruthy();
    const connector = (await connectorRes.json()) as LlmConnectorResponse;
    expect(connector.active?.id).toBe('ornith');
    expect(connector.active?.model).toBe(OSS_ORNITH_MODEL);
    expect(connector.contextOverflowCode).toBe('LLM_CONTEXT_TOO_LARGE');
    expect(connector.options?.some((o) => o.id === 'deepseek-opencode')).toBeTruthy();

    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('llm-connector-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('llm-connector-active')).toHaveAttribute(
      'data-connector-id',
      'ornith',
    );

    const deepseekOpt = connector.options?.find((o) => o.id === 'deepseek-opencode');
    expect(
      deepseekOpt?.credentialsConfigured,
      'Core must have OPENCODE_API_KEY for DeepSeek path (AC-059)',
    ).toBeTruthy();

    const putDeepseek = await request.put('/api/settings/llm-connector', {
      data: { connector: 'deepseek-opencode' },
    });
    expect(
      putDeepseek.ok(),
      `PUT deepseek-opencode failed: ${putDeepseek.status()} ${await putDeepseek.text()}`,
    ).toBeTruthy();
    const deepseekBody = (await putDeepseek.json()) as LlmConnectorResponse;
    expect(deepseekBody.active?.id).toBe('deepseek-opencode');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('llm-connector-active')).toHaveAttribute(
      'data-connector-id',
      'deepseek-opencode',
      { timeout: 30_000 },
    );

    // Restore Ornith for the investigation stage (DeterministicLLMClient is not the pass path).
    const restore = await request.put('/api/settings/llm-connector', {
      data: { connector: 'ornith' },
    });
    expect(
      restore.ok(),
      `restore ornith failed: ${restore.status()} ${await restore.text()}`,
    ).toBeTruthy();
    const restored = (await (await request.get('/api/settings/llm-connector')).json()) as LlmConnectorResponse;
    expect(restored.active?.id).toBe('ornith');
    expect(restored.active?.model).toBe(OSS_ORNITH_MODEL);

    // --- Stage AC-056/AC-060: create incident → analyses → triage → RCA → remediation → chat ---
    const stamp = Date.now();
    const title = `AC-061 capstone checkout latency ${stamp}`;
    const description =
      'p99 latency on checkout exceeded two seconds for five continuous minutes; ' +
      'test-app metrics and logs should support triage, root-cause, and remediation.';

    const createRes = await request.post('/api/incidents', {
      data: { title, description, severity: 'high' },
    });
    const createText = await createRes.text();
    expect(
      createRes.ok(),
      `POST /api/incidents failed: ${createRes.status()} ${createText}`,
    ).toBeTruthy();
    expect(createRes.status()).toBe(201);
    const createBody = JSON.parse(createText) as {
      incidentId?: string;
      incident?: { incidentId?: string };
    };
    let incidentId = createBody.incidentId ?? createBody.incident?.incidentId;
    expect(incidentId, 'expected incidentId from BFF create').toBeTruthy();

    await page.goto('/dashboard/analyses', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 60_000 });

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

    await expect(page.getByTestId('incident-severity')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('incident-severity')).toContainText(/high|critical|medium|low/i);
    await expect(page.getByTestId('incident-sse-progress')).toBeVisible({ timeout: 90_000 });

    let lastDetail: InvestigationDetailBody = {};
    let rootCause = '';
    let lastStatus = '';
    for (let i = 0; i < 120; i++) {
      const detailRes = await pollOk(request, `/api/investigation/${incidentId}/detail`);
      if (!detailRes.ok()) {
        await sleep(10_000);
        continue;
      }
      lastDetail = (await detailRes.json()) as InvestigationDetailBody;
      rootCause = (lastDetail.incident?.rootCause ?? '').trim();
      lastStatus = lastDetail.incident?.status ?? '';
      if (lastStatus === 'failed') break;
      if (
        rootCause.length > 0 &&
        !isBogusRootCause(rootCause) &&
        ['awaiting_approval', 'resolved', 'inconclusive', 'remediating'].includes(lastStatus)
      ) {
        break;
      }
      await sleep(8_000);
    }

    if (lastStatus === 'failed' || !rootCause || isBogusRootCause(rootCause)) {
      await sleep(70_000);
      const retryTitle = `AC-061 capstone checkout latency retry ${Date.now()}`;
      const retryRes = await request.post('/api/incidents', {
        data: { title: retryTitle, description, severity: 'high' },
      });
      expect(
        retryRes.ok(),
        `retry POST /api/incidents failed: ${retryRes.status()} ${await retryRes.text()}`,
      ).toBeTruthy();
      const retryBody = (await retryRes.json()) as {
        incidentId?: string;
        incident?: { incidentId?: string };
      };
      const retryId = retryBody.incidentId ?? retryBody.incident?.incidentId;
      expect(retryId, 'expected retry incidentId').toBeTruthy();

      await page.goto(`/dashboard/incidents/${retryId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: retryTitle })).toBeVisible({
        timeout: 30_000,
      });

      rootCause = '';
      lastStatus = '';
      lastDetail = {};
      for (let i = 0; i < 120; i++) {
        const detailRes = await pollOk(request, `/api/investigation/${retryId}/detail`);
        if (!detailRes.ok()) {
          await sleep(10_000);
          continue;
        }
        lastDetail = (await detailRes.json()) as InvestigationDetailBody;
        rootCause = (lastDetail.incident?.rootCause ?? '').trim();
        lastStatus = lastDetail.incident?.status ?? '';
        if (lastStatus === 'failed') break;
        if (
          rootCause.length > 0 &&
          !isBogusRootCause(rootCause) &&
          ['awaiting_approval', 'resolved', 'inconclusive', 'remediating'].includes(lastStatus)
        ) {
          break;
        }
        await sleep(8_000);
      }
      expect(
        lastStatus !== 'failed' && rootCause.length > 0 && !isBogusRootCause(rootCause),
        `expected real Core rootCause after retry; status=${lastStatus} rootCause=${rootCause.slice(0, 200)}`,
      ).toBeTruthy();
      incidentId = retryId as string;
    }

    expect(
      rootCause.length > 0 && !isBogusRootCause(rootCause),
      `expected Core rootCause for ${incidentId}; last status=${lastStatus} rootCause=${rootCause.slice(0, 200)}`,
    ).toBeTruthy();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('incident-root-cause')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('incident-root-cause-text')).toContainText(/\S+/, {
      timeout: 30_000,
    });

    const evidenceRoles = Object.keys(lastDetail.evidenceByAgent ?? {});
    expect(
      evidenceRoles.length > 0,
      `expected evidenceByAgent from Core for ${incidentId}`,
    ).toBeTruthy();

    let remediations: Array<{ remediationId?: string; status?: string; description?: string }> = [];
    for (let i = 0; i < 60; i++) {
      const remRes = await pollOk(
        request,
        `/api/remediations?incidentId=${encodeURIComponent(incidentId as string)}`,
      );
      if (!remRes.ok()) {
        await sleep(10_000);
        continue;
      }
      const remBody = (await remRes.json()) as {
        remediations?: Array<{ remediationId?: string; status?: string; description?: string }>;
      };
      remediations = remBody.remediations ?? [];
      if (remediations.length > 0) break;
      await sleep(8_000);
    }
    expect(
      remediations.length > 0,
      `expected ≥1 Core remediation for incident ${incidentId}`,
    ).toBeTruthy();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('incident-remediations')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('incident-remediations-count')).toContainText(/[1-9]/);

    const chatTab = page.getByTestId('incident-chat-tab');
    if (await chatTab.isVisible().catch(() => false)) {
      await chatTab.click();
    }
    const chatInput = page.getByTestId('incident-chat-input');
    await expect(chatInput).toBeVisible({ timeout: 30_000 });
    await chatInput.fill(
      'In one short sentence, what is the most likely root cause of this checkout latency?',
    );
    await page.getByTestId('incident-chat-send').click();

    const assistantBubble = page.getByTestId('incident-chat-assistant').last();
    let chatReply = '';
    try {
      await expect(assistantBubble).toBeVisible({ timeout: 180_000 });
      chatReply = ((await assistantBubble.textContent()) ?? '').trim();
    } catch {
      for (let i = 0; i < 36; i++) {
        const hist = await request.get(`/api/investigation/${incidentId}/chat`);
        if (hist.ok()) {
          const data = (await hist.json()) as {
            messages?: Array<{ role?: string; content?: string }>;
          };
          const assistant = [...(data.messages ?? [])]
            .reverse()
            .find((m) => m.role === 'assistant' && (m.content ?? '').trim().length > 0);
          if (assistant?.content) {
            chatReply = assistant.content.trim();
            break;
          }
        }
        await sleep(5_000);
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      if (await chatTab.isVisible().catch(() => false)) await chatTab.click();
      await expect(page.getByTestId('incident-chat-assistant').last()).toBeVisible({
        timeout: 60_000,
      });
      chatReply =
        chatReply ||
        ((await page.getByTestId('incident-chat-assistant').last().textContent()) ?? '').trim();
    }

    expect(chatReply.length, 'expected non-empty model-backed chat reply').toBeGreaterThan(10);
    expect(chatReply).not.toMatch(/DeterministicLLMClient/i);

    const connectorAfter = (await (
      await request.get('/api/settings/llm-connector')
    ).json()) as LlmConnectorResponse;
    expect(connectorAfter.active?.id).toBe('ornith');
    expect(connectorAfter.active?.model).toBe(OSS_ORNITH_MODEL);
  });
});
