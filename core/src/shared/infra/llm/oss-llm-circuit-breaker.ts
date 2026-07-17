/**
 * Per-endpoint OSS LLM circuit breakers (AC-018 / AC-055 / AC-059).
 *
 * A failed active Investigation LLM must not open a shared breaker that blocks
 * healthy fallbackProfileId hops. Reset all breakers when the operator switches
 * connectors after context overflow.
 */
import { CircuitBreaker, type CircuitBreakerOptions, type CircuitState } from './circuit-breaker.js';

let defaultOptions: CircuitBreakerOptions = {
  failureThreshold: 1,
  resetTimeoutMs: 60_000,
};

let onStateChange: ((from: CircuitState, to: CircuitState) => void) | undefined;

/** Legacy shared instance kept for Anthropic/health wiring that still pass one breaker. */
let legacySharedBreaker: CircuitBreaker | null = null;

const breakersByEndpointKey = new Map<string, CircuitBreaker>();

export function registerOssLlmCircuitBreaker(breaker: CircuitBreaker): void {
  legacySharedBreaker = breaker;
  defaultOptions = {
    failureThreshold: breaker.failureThreshold,
    resetTimeoutMs: breaker.resetTimeoutMs,
    halfOpenMaxAttempts: breaker.halfOpenMaxAttempts,
  };
  onStateChange = breaker.onStateChange;
}

/** Stable key for per-endpoint isolation (profileId preferred, else baseUrl). */
export function endpointCircuitBreakerKey(endpoint: {
  profileId?: string;
  baseUrl: string;
}): string {
  const profileId = endpoint.profileId?.trim();
  if (profileId) return `profile:${profileId}`;
  return `baseUrl:${endpoint.baseUrl}`;
}

export function getOssLlmCircuitBreakerForEndpoint(key: string): CircuitBreaker {
  let breaker = breakersByEndpointKey.get(key);
  if (!breaker) {
    breaker = new CircuitBreaker(defaultOptions, onStateChange);
    breakersByEndpointKey.set(key, breaker);
  }
  return breaker;
}

export function resetOssLlmCircuitBreaker(): void {
  legacySharedBreaker?.reset();
  for (const breaker of breakersByEndpointKey.values()) {
    breaker.reset();
  }
}

/** Test helper — clear registry between cases. */
export function clearOssLlmCircuitBreakersForTests(): void {
  legacySharedBreaker = null;
  breakersByEndpointKey.clear();
  onStateChange = undefined;
  defaultOptions = {
    failureThreshold: 1,
    resetTimeoutMs: 60_000,
  };
}
