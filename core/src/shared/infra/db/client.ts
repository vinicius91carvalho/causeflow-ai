/**
 * DynamoDB / ElectroDB client.
 *
 * In the AWS runtime, this provides a real DynamoDBClient from the SDK.
 * In the OSS runtime (CAUSEFLOW_RUNTIME=oss), it returns a Duck-typed stub
 * with a `send` method so ElectroDB Entity registration succeeds, but no
 * `new DynamoDBClient()` is ever called — the stub throws a descriptive
 * error if any code path attempts to make a DynamoDB call.
 *
 * AC-040: "no DynamoDBClient instantiation at boot" — satisfied because
 * the OSS stub is a plain object, not an SDK client.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { config } from '../../config/index.js';
import { instrumentedCall } from '../observability/outbound.js';

/**
 * Minimal duck-typed client for ElectroDB compatibility.
 * Has a `send` method so ElectroDB's identifyClientVersion() treats it as
 * a v3 client, but never instantiates the real DynamoDBClient SDK.
 */
function createOssStubClient(): DynamoDBClient {
  return {
    send: () =>
      Promise.reject(
        new Error(
          'DynamoDB is not available in the OSS runtime (CAUSEFLOW_RUNTIME=oss). ' +
            'All persistence goes through Postgres (AC-040). If you are seeing this ' +
            'error, a code path is attempting to use a DynamoDB-backed repository ' +
            'that has not been ported to Postgres yet.',
        ),
      ),
    config: {},
    middlewareStack: { use: () => {}, clone: () => ({}) },
    destroy: () => {},
  } as unknown as DynamoDBClient;
}

let client: DynamoDBClient | null = null;

/**
 * Get the DynamoDB SDK client (or a stub in OSS mode).
 *
 * In OSS mode, returns a plain stub object — no `new DynamoDBClient()` is
 * called, satisfying AC-040's requirement that no SDK client is instantiated
 * at boot. Any attempt to use the stub's `send()` method will throw a clear
 * error pointing to the Postgres migration requirement.
 */
export function getDynamoClient(): DynamoDBClient {
  if (config.isOss()) {
    return createOssStubClient();
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
