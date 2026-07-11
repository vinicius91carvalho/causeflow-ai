/**
 * Fail-closed helpers for the OSS Ornith / DeepSeek connectors (AC-055, AC-059).
 */
import type { CircuitBreaker, CircuitState } from './circuit-breaker.js';
import { resolveActiveLlmEndpoint } from './llm-connector-profile.js';

/** Documented probe timeout — matches LocalLlmHealthCheck. */
export const LOCAL_LLM_PROBE_TIMEOUT_MS = 5_000;

export const LOCAL_LLM_UNAVAILABLE_MESSAGE = 'Local LLM connector unavailable';

export async function probeLocalLlmReachable(): Promise<boolean> {
  try {
    const endpoint = await resolveActiveLlmEndpoint();
    if (endpoint.connectorId !== 'ornith' && !endpoint.apiKey) {
      return false;
    }
    const res = await fetch(`${endpoint.baseUrl}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${endpoint.apiKey}` },
      signal: AbortSignal.timeout(LOCAL_LLM_PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function assertLocalLlmReachable(
  circuitBreaker?: Pick<CircuitBreaker, 'getState'> | { getState(): CircuitState },
): Promise<void> {
  if (circuitBreaker?.getState() === 'open') {
    throw new Error(`${LOCAL_LLM_UNAVAILABLE_MESSAGE} (circuit breaker open)`);
  }
  const reachable = await probeLocalLlmReachable();
  if (!reachable) {
    throw new Error(LOCAL_LLM_UNAVAILABLE_MESSAGE);
  }
}
