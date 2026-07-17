import { describe, expect, it, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from '../../../../src/shared/infra/llm/circuit-breaker.js';
import {
  clearOssLlmCircuitBreakersForTests,
  endpointCircuitBreakerKey,
  getOssLlmCircuitBreakerForEndpoint,
  registerOssLlmCircuitBreaker,
  resetOssLlmCircuitBreaker,
} from '../../../../src/shared/infra/llm/oss-llm-circuit-breaker.js';

describe('oss-llm-circuit-breaker per-endpoint registry (AC-018)', () => {
  beforeEach(() => {
    clearOssLlmCircuitBreakersForTests();
    registerOssLlmCircuitBreaker(
      new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60_000 }),
    );
  });

  it('keys by profileId+baseUrl when profile present else baseUrl', () => {
    expect(
      endpointCircuitBreakerKey({ profileId: 'abc', baseUrl: 'http://a/v1' }),
    ).toBe('profile:abc|baseUrl:http://a/v1');
    expect(endpointCircuitBreakerKey({ baseUrl: 'http://a/v1' })).toBe('baseUrl:http://a/v1');
  });

  it('failed active endpoint does not open breaker for fallback endpoint', async () => {
    const active = getOssLlmCircuitBreakerForEndpoint(
      endpointCircuitBreakerKey({ profileId: 'bad', baseUrl: 'http://bad/v1' }),
    );
    const fallback = getOssLlmCircuitBreakerForEndpoint(
      endpointCircuitBreakerKey({ profileId: 'good', baseUrl: 'http://host.docker.internal:8081/v1' }),
    );

    await expect(
      active.execute(async () => {
        throw new Error('active down');
      }),
    ).rejects.toThrow('active down');

    expect(active.getState()).toBe('open');
    expect(fallback.getState()).toBe('closed');

    await expect(fallback.execute(async () => 'ok')).resolves.toBe('ok');
    await expect(active.execute(async () => 'should-block')).rejects.toBeInstanceOf(
      CircuitBreakerOpenError,
    );
  });

  it('resetOssLlmCircuitBreaker resets all endpoint breakers', async () => {
    const a = getOssLlmCircuitBreakerForEndpoint('profile:a');
    await expect(
      a.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    expect(a.getState()).toBe('open');

    resetOssLlmCircuitBreaker();
    expect(a.getState()).toBe('closed');
    await expect(a.execute(async () => 'recovered')).resolves.toBe('recovered');
  });
});
