/**
 * Fail-closed helpers for the OSS Ornith / DeepSeek connectors (AC-055, AC-059, AC-018).
 */
import type { CircuitBreaker, CircuitState } from './circuit-breaker.js';
import {
  INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR,
  InvestigationLlmChainExhaustedError,
  resolveActiveLlmEndpoint,
  resolveActiveLlmEndpointChain,
  type ResolvedLlmEndpoint,
} from './llm-connector-profile.js';

/** Documented probe timeout — matches LocalLlmHealthCheck. */
export const LOCAL_LLM_PROBE_TIMEOUT_MS = 5_000;

export const LOCAL_LLM_UNAVAILABLE_MESSAGE = 'Local LLM connector unavailable';

async function probeEndpoint(endpoint: ResolvedLlmEndpoint): Promise<boolean> {
  try {
    if (endpoint.connectorId !== 'ornith' && !endpoint.apiKey && !endpoint.profileId) {
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

export async function probeLocalLlmReachable(tenantId?: string): Promise<boolean> {
  try {
    if (tenantId) {
      // AC-018: follow fallbackProfileId chain (max depth / cycle-safe) before failing.
      const chain = await resolveActiveLlmEndpointChain(tenantId);
      for (const endpoint of chain) {
        if (await probeEndpoint(endpoint)) return true;
      }
      return false;
    }
    const endpoint = await resolveActiveLlmEndpoint();
    return probeEndpoint(endpoint);
  } catch {
    return false;
  }
}

export async function assertLocalLlmReachable(
  circuitBreaker?: Pick<CircuitBreaker, 'getState'> | { getState(): CircuitState },
  tenantId?: string,
): Promise<void> {
  // AC-018: when probing a fallbackProfileId chain, do not short-circuit on a single
  // shared breaker — a failed active must not block healthy fallback hops.
  if (!tenantId && circuitBreaker?.getState() === 'open') {
    throw new Error(`${LOCAL_LLM_UNAVAILABLE_MESSAGE} (circuit breaker open)`);
  }
  const reachable = await probeLocalLlmReachable(tenantId);
  if (!reachable) {
    if (tenantId) {
      // AC-018: chain missing/exhausted — clear configure/fix-LLM error; no silent stub/Anthropic.
      throw new InvestigationLlmChainExhaustedError(INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR);
    }
    throw new Error(LOCAL_LLM_UNAVAILABLE_MESSAGE);
  }
}
