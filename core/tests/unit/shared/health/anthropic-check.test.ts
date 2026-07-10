import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    anthropic: {
      apiKey: 'test-key',
    },
  },
}));

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { AnthropicHealthCheck } from '../../../../src/shared/infra/health/checks/anthropic-check.js';
import { CircuitBreaker } from '../../../../src/shared/infra/llm/circuit-breaker.js';

describe('AnthropicHealthCheck', () => {
  it('reports degraded when the shared circuit breaker is open', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60_000 });
    breaker.onFailure();
    const check = new AnthropicHealthCheck(breaker);

    const result = await check.check();

    expect(result.status).toBe('degraded');
    expect(result.details).toMatchObject({ circuitState: 'open' });
  });
});
