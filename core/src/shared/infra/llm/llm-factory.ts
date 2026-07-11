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

export function usesAnthropicOverride(): boolean {
  return Boolean(config.anthropic.apiKey);
}

export function usesLocalLlmConnector(): boolean {
  return config.isOss() && !usesAnthropicOverride();
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
    // Investigation agents still use the deterministic stub runner in OSS;
    // triage / synthesis / chat use the local LLM connector via LLMClient.
    return new StubAgentRunner();
  }
  return config.ptc.enabled ? new AnthropicPTCAgentRunner() : new AnthropicAgentRunner();
}
