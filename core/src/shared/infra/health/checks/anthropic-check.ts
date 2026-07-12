import { config } from '../../../config/index.js';
import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
import type { CircuitBreaker } from '../../llm/circuit-breaker.js';
export class AnthropicHealthCheck {
  circuitBreaker;
  name = 'anthropic';
  constructor(circuitBreaker: CircuitBreaker) {
    this.circuitBreaker = circuitBreaker;
  }
  async check(): Promise<HealthCheckResult> {
    // Anthropic check is skipped when no API key is configured (treated as ok
    // so it never fails the aggregated health in dev/keyless environments).
    if (!config.anthropic.apiKey) {
      return {
        name: this.name,
        status: 'ok',
        latencyMs: 0,
        details: { skipped: true, reason: 'ANTHROPIC_API_KEY not configured' },
      };
    }
    const start = Date.now();
    const state = this.circuitBreaker.getState();
    return {
      name: this.name,
      status: state === 'closed' ? 'ok' : 'degraded',
      latencyMs: Date.now() - start,
      details: { circuitState: state },
    };
  }
}
