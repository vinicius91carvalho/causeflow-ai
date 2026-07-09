import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { config } from '../../config/index.js';
import { instrumentedCall } from '../observability/outbound.js';

let client: DynamoDBClient | null = null;

/**
 * Get the DynamoDB SDK client.
 *
 * In the OSS runtime (CAUSEFLOW_RUNTIME=oss), this creates a client pointed
 * at a local-only endpoint that never reaches AWS. The client is fully
 * functional (ElectroDB accepts it) but any `send()` call will fail with a
 * connection refused error (or our custom handler). This satisfies AC-040's
 * requirement that no AWS endpoint is contacted at boot.
 */
export function getDynamoClient(): DynamoDBClient {
    if (config.isOss()) {
        return getOssDynamoClient();
    }

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

let ossClient: DynamoDBClient | null = null;

function getOssDynamoClient(): DynamoDBClient {
    if (!ossClient) {
        // Create a DynamoDB client pointed at localhost:1 (connection refused).
        // ElectroDB's entity init checks `instanceof`, so we must provide a
        // real DynamoDBClient. No network call is made at construction time —
        // only `send()` makes HTTP requests, which will fail with ECONNREFUSED.
        // Using the standard SDK client — it boots instantly with no I/O.
        ossClient = new DynamoDBClient({
            region: 'us-east-1',
            endpoint: 'http://127.0.0.1:1',
            maxAttempts: 0,
        });
    }
    return ossClient;
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
