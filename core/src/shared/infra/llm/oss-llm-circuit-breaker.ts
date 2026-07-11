/**
 * Shared OSS LLM circuit breaker instance (AC-055 / AC-059).
 * Reset when the operator switches connectors after context overflow.
 */
import type { CircuitBreaker } from './circuit-breaker.js';

let ossLlmCircuitBreaker: CircuitBreaker | null = null;

export function registerOssLlmCircuitBreaker(breaker: CircuitBreaker): void {
  ossLlmCircuitBreaker = breaker;
}

export function resetOssLlmCircuitBreaker(): void {
  ossLlmCircuitBreaker?.reset();
}
