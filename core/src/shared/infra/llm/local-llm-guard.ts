/**
 * Fail-closed helpers for the OSS Ornith connector (AC-055).
 * When the local LLM is configured but unreachable, triage/investigation must
 * surface a clear error instead of silently passing via stub clients.
 */
import { config } from '../../config/index.js';
import type { CircuitBreaker } from './circuit-breaker.js';

/** Documented probe timeout — matches LocalLlmHealthCheck. */
export const LOCAL_LLM_PROBE_TIMEOUT_MS = 5_000;

export const LOCAL_LLM_UNAVAILABLE_MESSAGE = 'Local LLM connector unavailable';

export async function probeLocalLlmReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${config.llm.baseUrl}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.llm.apiKey}` },
      signal: AbortSignal.timeout(LOCAL_LLM_PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function assertLocalLlmReachable(circuitBreaker?: CircuitBreaker): Promise<void> {
  if (circuitBreaker?.getState() === 'open') {
    throw new Error(`${LOCAL_LLM_UNAVAILABLE_MESSAGE} (circuit breaker open)`);
  }
  const reachable = await probeLocalLlmReachable();
  if (!reachable) {
    throw new Error(LOCAL_LLM_UNAVAILABLE_MESSAGE);
  }
}
