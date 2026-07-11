/**
 * Composition-root helpers for LLM client + agent runner wiring (AC-054).
 */
import { config } from '../../config/index.js';
import type { LLMClient } from '../../application/ports/llm-client.port.js';
import type { AgentRunner } from '../../application/ports/agent-runner.port.js';
import { AnthropicClient } from './anthropic-client.js';
import { AnthropicAgentRunner } from './anthropic-agent-runner.js';
import { AnthropicPTCAgentRunner } from './anthropic-ptc-agent-runner.js';
import { OpenAiCompatibleLlmClient } from './openai-compatible-llm-client.js';
import { StubAgentRunner } from './stub-agent-runner.js';
import { getActiveLlmConnectorId } from './oss-llm-connector-store.js';

export function usesAnthropicOverride(): boolean {
  return Boolean(config.anthropic.apiKey);
}

export function usesLocalLlmConnector(): boolean {
  return config.isOss() && !usesAnthropicOverride();
}

/** AC-059: whether the active OSS connector is a hosted DeepSeek profile. */
export async function usesDeepSeekConnector(): Promise<boolean> {
  if (!usesLocalLlmConnector()) return false;
  const id = await getActiveLlmConnectorId();
  return id === 'deepseek-opencode' || id === 'deepseek-nim';
}

/** AC-055: OSS Ornith connector must fail closed when unreachable. */
export function isLocalLlmFailClosedMode(): boolean {
  return usesLocalLlmConnector();
}

export function createRawLlmClient(circuitBreaker?: {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
}): LLMClient {
  if (usesAnthropicOverride()) {
    const client = new AnthropicClient();
    if (circuitBreaker) client.setCircuitBreaker(circuitBreaker);
    return client;
  }
  if (usesLocalLlmConnector()) {
    const client = new OpenAiCompatibleLlmClient();
    if (circuitBreaker) client.setCircuitBreaker(circuitBreaker);
    return client;
  }
  const client = new AnthropicClient();
  if (circuitBreaker) client.setCircuitBreaker(circuitBreaker);
  return client;
}

export function createRawAgentRunner(): AgentRunner {
  if (usesLocalLlmConnector()) {
    // AC-055: stub agents must not silently pass when Ornith is down.
    return new StubAgentRunner({ failClosed: true });
  }
  return config.ptc.enabled ? new AnthropicPTCAgentRunner() : new AnthropicAgentRunner();
}
