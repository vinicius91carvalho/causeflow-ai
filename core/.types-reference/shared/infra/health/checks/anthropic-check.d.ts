import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
import type { CircuitBreaker } from '../../llm/circuit-breaker.js';
export declare class AnthropicHealthCheck implements HealthCheck {
    private readonly circuitBreaker;
    readonly name = "anthropic";
    constructor(circuitBreaker: CircuitBreaker);
    check(): Promise<HealthCheckResult>;
}
