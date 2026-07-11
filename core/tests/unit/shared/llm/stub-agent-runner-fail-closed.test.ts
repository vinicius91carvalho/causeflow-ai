import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../src/shared/infra/llm/local-llm-guard.js', () => ({
  LOCAL_LLM_UNAVAILABLE_MESSAGE: 'Local LLM connector unavailable',
  probeLocalLlmReachable: vi.fn(),
}));

import { probeLocalLlmReachable } from '../../../../src/shared/infra/llm/local-llm-guard.js';
import { StubAgentRunner } from '../../../../src/shared/infra/llm/stub-agent-runner.js';

describe('StubAgentRunner fail-closed (AC-055)', () => {
  beforeEach(() => {
    vi.mocked(probeLocalLlmReachable).mockReset();
  });

  it('throws when failClosed is enabled and the connector is down', async () => {
    vi.mocked(probeLocalLlmReachable).mockResolvedValue(false);
    const runner = new StubAgentRunner({ failClosed: true });
    await expect(
      runner.run({
        systemPrompt: 'log analysis specialist',
        userPrompt: 'analyze logs',
        tools: [],
        toolHandler: async () => 'ok',
      }),
    ).rejects.toThrow(/Local LLM connector unavailable/);
  });

  it('still returns deterministic output when failClosed is enabled but connector is up', async () => {
    vi.mocked(probeLocalLlmReachable).mockResolvedValue(true);
    const runner = new StubAgentRunner({ failClosed: true });
    const result = await runner.run({
      systemPrompt: 'log analysis specialist',
      userPrompt: 'analyze logs',
      tools: [],
      toolHandler: async () => 'ok',
    });
    expect(result.model).toBe('stub-agent');
    expect(result.response).toContain('Log analysis complete');
  });

  it('still returns deterministic output when failClosed is disabled', async () => {
    const runner = new StubAgentRunner({ failClosed: false });
    const result = await runner.run({
      systemPrompt: 'log analysis specialist',
      userPrompt: 'analyze logs',
      tools: [],
      toolHandler: async () => 'ok',
    });
    expect(result.model).toBe('stub-agent');
    expect(result.response).toContain('Log analysis complete');
  });
});
