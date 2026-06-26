export interface HealthCheckResult {
    name: string;
    status: 'ok' | 'degraded' | 'down';
    latencyMs: number;
    details?: Record<string, unknown>;
}
export interface HealthCheck {
    name: string;
    check(): Promise<HealthCheckResult>;
}
export interface AggregatedHealth {
    status: 'ok' | 'degraded' | 'down';
    checks: HealthCheckResult[];
    timestamp: string;
}
export declare class HealthChecker {
    private checks;
    register(check: HealthCheck): void;
    runAll(): Promise<AggregatedHealth>;
}
