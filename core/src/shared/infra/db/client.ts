import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { config } from '../../config/index.js';
import { instrumentedCall } from '../observability/outbound.js';

let client: DynamoDBClient | null = null;

export function getDynamoClient(): DynamoDBClient {
    if (!client) {
        client = new DynamoDBClient({
            region: config.aws.region,
            ...(config.aws.dynamoEndpoint && {
                endpoint: config.aws.dynamoEndpoint,
            }),
        });
    }
    return client;
}

/**
 * Instrumented DynamoDB send — wraps any SDK command with observability.
 * Use this instead of `getDynamoClient().send(cmd)` in repositories.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dynamoSend(cmd: { constructor: { name: string } }, opts?: unknown): Promise<any> {
    const operation = cmd.constructor.name.replace('Command', '').toLowerCase();
    return instrumentedCall(
        'dynamodb',
        operation,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => (getDynamoClient() as any).send(cmd, opts),
        { attributes: { tableName: config.aws.tableName, operation } },
    );
}
