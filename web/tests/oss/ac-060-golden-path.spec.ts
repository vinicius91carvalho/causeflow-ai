/**
 * AC-060 — Dashboard golden path: analyses, triage, chat, root cause, remediation.
 *
 * Pass path: connected test app (AC-058) + Ornith LLM (AC-059) → real Core
 * incident via dashboard BFF → analyses list/detail update → triage severity →
 * model-backed incident chat → root-cause hypothesis/evidence → remediation
 * proposal. Progress is live from Core (SSE + documented polling).
 *
 * Not a pass path: Playwright `page.route` fixtures, DeterministicLLMClient.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL, OSS_ORNITH_BASE_URL, OSS_ORNITH_MODEL } from './helpers';

const STUB_UPSTREAM_URL = process.env.OSS_STUB_UPSTREAM_URL || 'http://127.0.0.1:5190';

type LlmConnectorResponse = {
  active?: { id?: string; model?: string; baseUrl?: string };
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

async function ensureTestAppConnected(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  const stubHealth = await fetch(`${STUB_UPSTREAM_URL}/health`).catch(() => null);
  expect(
    stubHealth?.ok,
    `Test application not reachable at ${STUB_UPSTREAM_URL}/health`,
  ).toBeTruthy();

  const listRes = await request.get('/api/integrations');
  expect(listRes.ok()).toBeTruthy();
  const listBody = (await listRes.json()) as {
    integrations?: Array<{ provider?: string; type?: string; status?: string }>;
  };
  const integrations = listBody.integrations ?? [];
  const hasStub = integrations.some(
    (i) =>
      (i.provider === 'stub-upstream' || i.type === 'stub-upstream') &&
      ['active', 'connected'].includes(String(i.status).toLowerCase()),
  );
  const hasDatadog = integrations.some(
    (i) =>
      (i.provider === 'datadog' || i.type === 'datadog') &&
      ['active', 'connected'].includes(String(i.status).toLowerCase()),
  );
  if (hasStub && hasDatadog) return;

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
}

test.describe('AC-060 — golden path analyses/triage/chat/root-cause/remediation', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('drives full Core investigation: triage, chat, root cause, remediation', async ({
    page,
    request,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-060' });
    // Full Ornith investigation + remediation can take several minutes.
    test.setTimeout(600_000);

    const ornith = await fetch(`${OSS_ORNITH_BASE_URL}/models`).catch(() => null);
    expect(ornith?.ok, `Ornith not reachable at ${OSS_ORNITH_BASE_URL}/models`).toBeTruthy();

    const coreHealth = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(coreHealth?.ok, `Core not reachable at ${OSS_CORE_API_URL}/health`).toBeTruthy();
    if (!coreHealth) throw new Error('Core /health unreachable');
    const healthJson = (await coreHealth.json()) as Record<string, string>;
    expect(healthJson.llm, `Core llm must be ok; got ${JSON.stringify(healthJson)}`).toBe('ok');

    await page.goto('/dashboard/analyses', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/clerk\./);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    await dismissWelcome(page);

    const connectorRes = await request.get('/api/settings/llm-connector');
    expect(
      connectorRes.ok(),
      `GET /api/settings/llm-connector failed: ${connectorRes.status()}`,
    ).toBeTruthy();
    const connector = (await connectorRes.json()) as LlmConnectorResponse;
    expect(connector.active?.id).toBe('ornith');
    expect(connector.active?.model).toBe(OSS_ORNITH_MODEL);

    await ensureTestAppConnected(page, request);

    const stamp = Date.now();
    const title = `AC-060 checkout latency ${stamp}`;
    const description =
      'p99 latency on checkout exceeded two seconds for five continuous minutes; ' +
      'test-app metrics and logs should support triage, root-cause, and remediation.';

    // Step 1 — create real Core incident through dashboard BFF (no page.route mocks).
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

    // Analyses list shows the new incident.
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

    // Triage severity from Core (not Playwright fixtures).
    await expect(page.getByTestId('incident-severity')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('incident-severity')).toContainText(/high|critical|medium|low/i);

    // Live progress label (SSE or documented polling refresh).
    const progress = page.getByTestId('incident-sse-progress');
    await expect(progress).toBeVisible({ timeout: 90_000 });

    // Poll Core-backed detail until a real root cause + terminal-ish status.
    // Retry through Core RATE_LIMIT (429); never treat circuit-breaker failure text as pass.
    let lastDetail: InvestigationDetailBody = {};
    let rootCause = '';
    let lastStatus = '';
    for (let i = 0; i < 120; i++) {
      const detailRes = await pollOk(request, `/api/investigation/${incidentId}/detail`);
      const detailText = await detailRes.text();
      if (!detailRes.ok()) {
        await sleep(10_000);
        continue;
      }
      lastDetail = JSON.parse(detailText) as InvestigationDetailBody;
      rootCause = (lastDetail.incident?.rootCause ?? '').trim();
      lastStatus = lastDetail.incident?.status ?? '';
      if (lastStatus === 'failed') {
        // Soft-fail this attempt: wait for LLM circuit cool-down is handled by
        // creating a fresh incident below when we detect bogus/failed outcome.
        break;
      }
      if (
        rootCause.length > 0 &&
        !isBogusRootCause(rootCause) &&
        ['awaiting_approval', 'resolved', 'inconclusive', 'remediating'].includes(lastStatus)
      ) {
        break;
      }
      await sleep(8_000);
    }

    // If the first incident hit Core LLM circuit-breaker / failed, create one more
    // after cool-down — Ornith may have been briefly unavailable under load.
    if (lastStatus === 'failed' || !rootCause || isBogusRootCause(rootCause)) {
      await sleep(70_000);
      const retryTitle = `AC-060 checkout latency retry ${Date.now()}`;
      const retryRes = await request.post('/api/incidents', {
        data: {
          title: retryTitle,
          description,
          severity: 'high',
        },
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

    // Refresh UI to evidence-review / root-cause surface.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('incident-root-cause')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('incident-root-cause-text')).toContainText(/\S+/, {
      timeout: 30_000,
    });

    // Evidence present from Core investigation (not empty fixture).
    const evidenceRoles = Object.keys(lastDetail.evidenceByAgent ?? {});
    expect(
      evidenceRoles.length > 0,
      `expected evidenceByAgent from Core for ${incidentId}`,
    ).toBeTruthy();

    // Remediation proposal from Core — poll BFF then assert UI (retry 429).
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
    // Evidence-review rail or live remediations section.
    const remUi = page.getByTestId('incident-remediations');
    await expect(remUi).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('incident-remediations-count')).toContainText(/[1-9]/);

    // Step 2 — talk to the model on the incident (REST chat → Ornith-backed reply).
    const chatTab = page.getByTestId('incident-chat-tab');
    if (await chatTab.isVisible().catch(() => false)) {
      await chatTab.click();
    }
    const chatInput = page.getByTestId('incident-chat-input');
    await expect(chatInput).toBeVisible({ timeout: 30_000 });
    const question =
      'In one short sentence, what is the most likely root cause of this checkout latency?';
    await chatInput.fill(question);
    await page.getByTestId('incident-chat-send').click();

    // Prefer UI assistant bubble; also accept BFF chat history as Core-backed proof.
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

    // Connector still Ornith — DeterministicLLMClient is not the pass path.
    const connectorAfter = (await (
      await request.get('/api/settings/llm-connector')
    ).json()) as LlmConnectorResponse;
    expect(connectorAfter.active?.id).toBe('ornith');
    expect(connectorAfter.active?.model).toBe(OSS_ORNITH_MODEL);
  });
});
