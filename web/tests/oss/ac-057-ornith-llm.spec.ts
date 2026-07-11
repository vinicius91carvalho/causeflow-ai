/**
 * AC-057 — Investigation uses Ornith 9B via Core's local LLM connector.
 *
 * Pass path: Core OpenAI-compatible connector → Ornith on :8081
 * (model `Ornith-1.0-9B-code`) with ≥1 `llm_completion` evidence attributable
 * to the AC-056 incident created through the dashboard BFF.
 *
 * Not a pass path: DeterministicLLMClient stub or Anthropic-required fallback.
 * Fail-closed: when Ornith is unreachable, Core `/health` reports llm degraded
 * with a clear message (no silent stub auto-pass).
 */

import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL, OSS_ORNITH_BASE_URL, OSS_ORNITH_MODEL } from './helpers';

type LlmConnectorResponse = {
  active?: {
    id?: string;
    model?: string;
    baseUrl?: string;
  };
};

type InvestigationDetailBody = {
  incident?: { incidentId?: string; status?: string; severity?: string };
  evidenceByAgent?: Record<
    string,
    Array<{
      content?: string;
      metadata?: {
        source?: string;
        llmModel?: string;
        llmConnector?: string;
        phase?: string;
      };
    }>
  >;
};

function evidenceHasOrnithCompletion(detail: InvestigationDetailBody): boolean {
  for (const items of Object.values(detail.evidenceByAgent ?? {})) {
    for (const ev of items ?? []) {
      const meta = ev.metadata ?? {};
      const blob = `${meta.llmModel ?? ''} ${meta.source ?? ''} ${ev.content ?? ''}`;
      if (
        meta.source === 'llm_completion' ||
        (meta.llmModel ?? '').includes('Ornith') ||
        blob.includes(OSS_ORNITH_MODEL) ||
        blob.includes('Ornith')
      ) {
        return true;
      }
    }
  }
  return false;
}

async function sessionBearer(page: import('@playwright/test').Page): Promise<string> {
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === '__session');
  const value = session?.value;
  expect(value, 'expected __session JWT from OSS auth setup').toBeTruthy();
  return value as string;
}

function findLlamaServerPid(): string {
  // Use exact process name — `pgrep -f llama-server` also matches the tmux/zsh
  // restart wrapper whose argv embeds the llama-server path.
  try {
    const out = execFileSync('pgrep', ['-x', 'llama-server'], { encoding: 'utf8' }).trim();
    const first = out
      .split('\n')
      .map((s) => s.trim())
      .find(Boolean);
    if (first) return first;
  } catch {
    // fall through
  }
  try {
    const out = execFileSync('pidof', ['llama-server'], { encoding: 'utf8' }).trim();
    return out.split(/\s+/)[0] ?? '';
  } catch {
    return '';
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

test.describe('AC-057 — Ornith local LLM investigation evidence', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('AC-056 incident triage/investigation uses Ornith (not stub/Anthropic)', async ({
    page,
    request,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-057' });
    // Ornith synthesis can take ~2–3 minutes on 9B local inference.
    test.setTimeout(360_000);

    // Step 1: Ornith reachable + Core configured for OpenAI-compatible Ornith.
    const ornithModels = await fetch(`${OSS_ORNITH_BASE_URL}/models`).catch(() => null);
    expect(
      ornithModels?.ok,
      `Ornith not reachable at ${OSS_ORNITH_BASE_URL}/models. ` +
        'Start with ~/tools/llama-session.sh before AC-057.',
    ).toBeTruthy();
    if (!ornithModels) throw new Error('Ornith /models unreachable');
    const modelsBody = (await ornithModels.json()) as {
      data?: Array<{ id?: string }>;
      models?: Array<{ name?: string; model?: string }>;
    };
    const modelIds = [
      ...(modelsBody.data ?? []).map((m) => m.id ?? ''),
      ...(modelsBody.models ?? []).map((m) => m.name ?? m.model ?? ''),
    ];
    expect(
      modelIds.some((id) => id.includes('Ornith')),
      `expected Ornith model alias in /models, got ${JSON.stringify(modelIds)}`,
    ).toBeTruthy();

    const coreHealth = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(coreHealth?.ok, `Core API not reachable at ${OSS_CORE_API_URL}/health`).toBeTruthy();
    if (!coreHealth) throw new Error('Core /health unreachable');
    const healthJson = (await coreHealth.json()) as Record<string, string>;
    expect(
      healthJson.llm,
      `Core llm health must be ok with Ornith up; got ${JSON.stringify(healthJson)}`,
    ).toBe('ok');

    await page.goto('/dashboard/analyses', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/clerk\./);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    await expect(page.locator('main')).toBeVisible();

    const token = await sessionBearer(page);
    const connectorRes = await fetch(`${OSS_CORE_API_URL}/v1/oss/llm-connector`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const connectorText = await connectorRes.text();
    expect(
      connectorRes.ok,
      `GET /v1/oss/llm-connector failed: ${connectorRes.status} ${connectorText}`,
    ).toBeTruthy();
    const connector = JSON.parse(connectorText) as LlmConnectorResponse;
    expect(connector.active?.id).toBe('ornith');
    expect(connector.active?.model).toBe(OSS_ORNITH_MODEL);
    expect(
      connector.active?.baseUrl ?? '',
      `expected OpenAI-compatible Ornith base URL, got ${connector.active?.baseUrl}`,
    ).toMatch(/8081\/v1|host\.docker\.internal:8081\/v1/);

    const welcome = page.getByRole('dialog', { name: /Welcome, Detective/i });
    try {
      await welcome.waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByRole('button', { name: /Skip Tutorial/i }).click();
      await expect(welcome).toBeHidden({ timeout: 10_000 });
    } catch {
      // Modal not shown.
    }

    const stamp = Date.now();
    const title = `AC-057 Ornith checkout latency ${stamp}`;
    const description =
      'p99 latency on checkout exceeded two seconds for five continuous minutes; ' +
      'prove triage/investigation uses local Ornith 9B via Core OpenAI-compatible connector.';

    // AC-056 create path: dashboard BFF → Core (no page.route mocks).
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
    const incidentId = createBody.incidentId ?? createBody.incident?.incidentId;
    expect(incidentId, 'expected incidentId from BFF create').toBeTruthy();

    // Open detail + live SSE (same surface as AC-056).
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

    // Step 2: poll BFF investigation detail until ≥1 Ornith llm_completion evidence.
    let foundOrnith = false;
    let lastDetail: InvestigationDetailBody = {};
    for (let i = 0; i < 90; i++) {
      const detailRes = await request.get(`/api/investigation/${incidentId}/detail`);
      const detailText = await detailRes.text();
      expect(
        detailRes.ok(),
        `GET /api/investigation/${incidentId}/detail failed: ${detailRes.status()} ${detailText}`,
      ).toBeTruthy();
      lastDetail = JSON.parse(detailText) as InvestigationDetailBody;
      if (evidenceHasOrnithCompletion(lastDetail)) {
        foundOrnith = true;
        break;
      }
      if ((lastDetail.incident?.status ?? '') === 'failed') {
        break;
      }
      await sleep(3_000);
    }

    expect(
      foundOrnith,
      `expected ≥1 Ornith llm_completion evidence for incident ${incidentId}; ` +
        `last status=${lastDetail.incident?.status} ` +
        `agents=${JSON.stringify(Object.keys(lastDetail.evidenceByAgent ?? {}))}`,
    ).toBeTruthy();

    // Connector remains ornith — Anthropic is not required for the happy path.
    const connectorAfter = (await (
      await fetch(`${OSS_CORE_API_URL}/v1/oss/llm-connector`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json()) as LlmConnectorResponse;
    expect(connectorAfter.active?.id).toBe('ornith');
    expect(connectorAfter.active?.model).toBe(OSS_ORNITH_MODEL);
  });

  test('fails closed with clear Core llm health error when Ornith is stopped', async ({ page }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-057' });
    test.setTimeout(120_000);

    const coreHealthBefore = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
    expect(coreHealthBefore?.ok).toBeTruthy();

    const llamaPid = findLlamaServerPid();
    expect(llamaPid, 'expected llama-server process to pause for fail-closed probe').toBeTruthy();

    try {
      execFileSync('kill', ['-STOP', llamaPid]);

      let degraded: Record<string, string> | null = null;
      for (let i = 0; i < 25; i++) {
        const res = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
        if (res?.ok) {
          const body = (await res.json()) as Record<string, string>;
          if (body.llm && body.llm !== 'ok') {
            degraded = body;
            break;
          }
        }
        await sleep(1_000);
      }

      expect(
        degraded,
        'expected Core /health llm != ok while Ornith is stopped (fail closed, no stub auto-pass)',
      ).toBeTruthy();
      if (!degraded) throw new Error('Core llm health did not degrade while Ornith was stopped');
      expect(degraded.llm).not.toBe('ok');
      expect(['degraded', 'down', 'error', 'unavailable']).toContain(degraded.llm);

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/clerk\./);
    } finally {
      try {
        execFileSync('kill', ['-CONT', llamaPid]);
      } catch {
        // best-effort resume
      }
      for (let i = 0; i < 40; i++) {
        const ornith = await fetch(`${OSS_ORNITH_BASE_URL}/models`).catch(() => null);
        const health = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
        const body = health?.ok ? ((await health.json()) as Record<string, string>) : null;
        if (ornith?.ok && body?.llm === 'ok') break;
        await sleep(1_000);
      }
    }
  });
});
