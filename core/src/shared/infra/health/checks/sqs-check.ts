import { GetQueueAttributesCommand, SQSClient } from '@aws-sdk/client-sqs';
import { config } from '../../../config/index.js';
import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
export class SQSHealthCheck {
    queueUrls;
    name = 'sqs';
    constructor(queueUrls: (string | undefined)[]) {
        this.queueUrls = queueUrls;
    }
    async check(): Promise<HealthCheckResult> {
        const start = Date.now();
        const configuredUrls = this.queueUrls.filter(Boolean);
        if (configuredUrls.length === 0) {
            return { name: this.name, status: 'ok', latencyMs: 0, details: { message: 'No queues configured' } };
        }
        try {
            const client = new SQSClient({
                region: config.aws.region,
                ...(config.aws.sqsEndpoint && { endpoint: config.aws.sqsEndpoint }),
            });
            const results = await Promise.allSettled(configuredUrls.map((url) => client.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ['ApproximateNumberOfMessages'] }))));
            const failed = results.filter((r) => r.status === 'rejected');
            if (failed.length === configuredUrls.length) {
                return { name: this.name, status: 'down', latencyMs: Date.now() - start };
            }
            if (failed.length > 0) {
                return { name: this.name, status: 'degraded', latencyMs: Date.now() - start, details: { failedQueues: failed.length } };
            }
            return { name: this.name, status: 'ok', latencyMs: Date.now() - start, details: { queuesChecked: configuredUrls.length } };
        }
        catch (err) {
            return {
                name: this.name,
                status: 'down',
                latencyMs: Date.now() - start,
                details: { error: err instanceof Error ? err.message : 'Unknown' },
            };
        }
    }
}
