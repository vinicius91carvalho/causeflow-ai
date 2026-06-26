import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
import type { CircuitBreaker } from '../../llm/circuit-breaker.js';
export class AnthropicHealthCheck {
    circuitBreaker;
    name = 'anthropic';
    constructor(circuitBreaker: CircuitBreaker) {
        this.circuitBreaker = circuitBreaker;
    }
    async check(): Promise<HealthCheckResult> {
        const start = Date.now();
        const state = this.circuitBreaker.getState();
        return {
            name: this.name,
            status: state === 'closed' ? 'ok' : state === 'half_open' ? 'degraded' : 'down',
            latencyMs: Date.now() - start,
            details: { circuitState: state },
        };
    }
}
