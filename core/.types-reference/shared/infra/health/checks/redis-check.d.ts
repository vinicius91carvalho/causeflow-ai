import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
export declare class RedisHealthCheck implements HealthCheck {
    private readonly getClient;
    readonly name = "redis";
    constructor(getClient: () => any);
    check(): Promise<HealthCheckResult>;
}
