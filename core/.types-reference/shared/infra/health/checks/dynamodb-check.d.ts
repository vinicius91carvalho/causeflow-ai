import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
export declare class DynamoDBHealthCheck implements HealthCheck {
    readonly name = "dynamodb";
    check(): Promise<HealthCheckResult>;
}
