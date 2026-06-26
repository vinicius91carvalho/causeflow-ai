import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { getDynamoClient } from '../../db/client.js';
import { TABLE_NAME } from '../../db/table.js';
import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
export class DynamoDBHealthCheck {
    name = 'dynamodb';
    async check(): Promise<HealthCheckResult> {
        const start = Date.now();
        try {
            const client = getDynamoClient();
            await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
            return {
                name: this.name,
                status: 'ok',
                latencyMs: Date.now() - start,
            };
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
