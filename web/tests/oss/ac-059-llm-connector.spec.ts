/**
 * AC-059 — Dashboard configures investigation LLM connector.
 *
 * Steps:
 * 1. With Ornith up, dashboard BFF/settings shows Ornith as active default.
 * 2. Operator switches to DeepSeek V4 Flash (OpenCode Go) via BFF PUT
 *    (simulates recovery from Core LLM_CONTEXT_TOO_LARGE).
 * 3. Core /v1/oss/llm-connector + /health reflect DeepSeek; no Anthropic key required.
 *
 * Credentials stay on Core/operator host — never asserted from the repo.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers, OSS_CORE_API_URL, OSS_ORNITH_BASE_URL, OSS_ORNITH_MODEL } from './helpers';

type LlmConnectorResponse = {
  active?: {
    id?: string;
    label?: string;
    model?: string;
    baseUrl?: string;
    credentialsConfigured?: boolean;
  };
  options?: Array<{ id?: string; model?: string; credentialsConfigured?: boolean }>;
  contextOverflowCode?: string;
};

async function sessionBearer(page: import('@playwright/test').Page): Promise<string> {
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === '__session');
  const value = session?.value;
  expect(value, 'expected __session JWT from OSS auth setup').toBeTruthy();
  return value as string;
}

test.describe('AC-059 — investigation LLM connector selection', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('settings BFF shows Ornith default, switches to DeepSeek, Core reflects active', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const ornithModels = await fetch(`${OSS_ORNITH_BASE_URL}/models`).catch(() => null);
    expect(ornithModels?.ok, `Ornith not reachable at ${OSS_ORNITH_BASE_URL}/models`).toBeTruthy();

    const token = await sessionBearer(page);

    // Reset Core to Ornith so prior WI runs do not leak Redis overrides.
    const reset = await fetch(`${OSS_CORE_API_URL}/v1/oss/llm-connector`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ connector: 'ornith' }),
    });
    expect(reset.ok, `reset to ornith failed: ${reset.status} ${await reset.text()}`).toBeTruthy();

    // Step 1: dashboard BFF documents Ornith as active default + overflow code.
    const bffGet = await page.request.get('/api/settings/llm-connector');
    expect(bffGet.ok(), `BFF GET failed: ${bffGet.status()} ${await bffGet.text()}`).toBeTruthy();
    const bffDefault = (await bffGet.json()) as LlmConnectorResponse;
    expect(bffDefault.active?.id).toBe('ornith');
    expect(bffDefault.active?.model).toBe(OSS_ORNITH_MODEL);
    expect(bffDefault.contextOverflowCode).toBe('LLM_CONTEXT_TOO_LARGE');
    expect(bffDefault.options?.some((o) => o.id === 'deepseek-opencode')).toBeTruthy();
    expect(bffDefault.options?.some((o) => o.id === 'deepseek-nim')).toBeTruthy();

    // Settings UI surfaces the active connector.
    await page.goto('/dashboard/settings');
    await expect(page.getByTestId('llm-connector-card')).toBeVisible({ timeout: 30_000 });
    const active = page.getByTestId('llm-connector-active');
    await expect(active).toHaveAttribute('data-connector-id', 'ornith');
    await expect(active).toHaveAttribute('data-connector-model', OSS_ORNITH_MODEL);
    await expect(page.getByTestId('llm-connector-overflow-code')).toHaveAttribute(
      'data-overflow-code',
      'LLM_CONTEXT_TOO_LARGE',
    );

    // Step 2: switch to DeepSeek V4 Flash via OpenCode Go (runtime host creds on Core).
    const deepseekOpt = bffDefault.options?.find((o) => o.id === 'deepseek-opencode');
    expect(
      deepseekOpt?.credentialsConfigured,
      'Core must have OPENCODE_API_KEY (from operator host) for DeepSeek path',
    ).toBeTruthy();

    const bffPut = await page.request.put('/api/settings/llm-connector', {
      data: { connector: 'deepseek-opencode' },
    });
    const putText = await bffPut.text();
    expect(
      bffPut.ok(),
      `BFF PUT deepseek-opencode failed: ${bffPut.status()} ${putText}`,
    ).toBeTruthy();
    const putBody = JSON.parse(putText) as LlmConnectorResponse;
    expect(putBody.active?.id).toBe('deepseek-opencode');
    expect(putBody.active?.model ?? '').toMatch(/deepseek/i);

    // Step 3: Core settings + health reflect DeepSeek; Anthropic not required.
    const coreAfter = (await (
      await fetch(`${OSS_CORE_API_URL}/v1/oss/llm-connector`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json()) as LlmConnectorResponse;
    expect(coreAfter.active?.id).toBe('deepseek-opencode');
    expect(coreAfter.active?.model ?? '').toMatch(/deepseek/i);

    const health = (await (await fetch(`${OSS_CORE_API_URL}/health`)).json()) as {
      llm?: string;
      anthropic?: string;
    };
    // llm may be ok or degraded depending on live DeepSeek reachability; connector id is the contract.
    expect(health.llm, `Core /health missing llm field: ${JSON.stringify(health)}`).toBeTruthy();

    const bffAfter = (await (
      await page.request.get('/api/settings/llm-connector')
    ).json()) as LlmConnectorResponse;
    expect(bffAfter.active?.id).toBe('deepseek-opencode');

    await page.reload();
    await expect(page.getByTestId('llm-connector-active')).toHaveAttribute(
      'data-connector-id',
      'deepseek-opencode',
      { timeout: 30_000 },
    );

    // Restore Ornith default for sibling OSS specs (AC-057).
    const restore = await page.request.put('/api/settings/llm-connector', {
      data: { connector: 'ornith' },
    });
    expect(
      restore.ok(),
      `restore ornith failed: ${restore.status()} ${await restore.text()}`,
    ).toBeTruthy();
  });
});
