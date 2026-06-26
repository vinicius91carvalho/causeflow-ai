import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
export declare class SQSHealthCheck implements HealthCheck {
    private readonly queueUrls;
    readonly name = "sqs";
    constructor(queueUrls: (string | undefined)[]);
    check(): Promise<HealthCheckResult>;
}
