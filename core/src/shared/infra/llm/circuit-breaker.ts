import { logger } from '../logger.js';
import { shouldCountLlmCircuitFailure } from './llm-context-errors.js';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
}

export class CircuitBreaker {
  state: CircuitState = 'closed';
  failureCount = 0;
  lastFailureTime = 0;
  halfOpenAttempts = 0;
  failureThreshold;
  resetTimeoutMs;
  halfOpenMaxAttempts;
  onStateChange;
  constructor(
    options?: CircuitBreakerOptions,
    onStateChange?: (from: CircuitState, to: CircuitState) => void,
  ) {
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 60_000;
    this.halfOpenMaxAttempts = options?.halfOpenMaxAttempts ?? 1;
    this.onStateChange = onStateChange;
  }
  getState(): CircuitState {
    if (this.state === 'open' && Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
      this.transition('half_open');
    }
    return this.state;
  }
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();
    if (currentState === 'open') {
      throw new CircuitBreakerOpenError(this.resetTimeoutMs - (Date.now() - this.lastFailureTime));
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      if (shouldCountLlmCircuitFailure(error)) {
        this.onFailure();
      }
      throw error;
    }
  }
  onSuccess() {
    if (this.state === 'half_open') {
      this.failureCount = 0;
      this.halfOpenAttempts = 0;
      this.transition('closed');
    } else {
      this.failureCount = 0;
    }
  }
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === 'half_open') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        this.transition('open');
      }
    } else if (this.failureCount >= this.failureThreshold) {
      this.transition('open');
    }
  }
  transition(newState: CircuitState) {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    logger.info({ from: oldState, to: newState }, 'Circuit breaker state change');
    this.onStateChange?.(oldState, newState);
  }
  reset(): void {
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = 0;
    if (this.state !== 'closed') {
      this.transition('closed');
    }
  }
}
export class CircuitBreakerOpenError extends Error {
  retryAfterMs;
  constructor(retryAfterMs: number) {
    super(`Circuit breaker is open. Retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.retryAfterMs = retryAfterMs;
    this.name = 'CircuitBreakerOpenError';
  }
}
