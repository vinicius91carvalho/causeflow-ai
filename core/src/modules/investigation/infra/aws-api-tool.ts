/**
 * Generic AWS API Tool — 1 tool that covers ALL AWS services (read-only).
 *
 * The agent (via code execution) calls `aws_api_call(service, action, params)`.
 * This handler:
 *  1. Validates action is read-only via aws-api-security.ts
 *  2. Resolves SDK client dynamically via aws-service-map.ts
 *  3. Creates client with STS credentials (already vended)
 *  4. Executes Command, strips $metadata, returns JSON
 */
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { validateAwsApiCall } from './aws-api-security.js';
import { getServiceEntry } from './aws-service-map.js';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { CloudCredentials } from '../../../shared/application/ports/cloud-provider.port.js';
export const awsApiCallInputSchema = z.object({
    service: z.string().describe('AWS service short name (e.g., "ecs", "rds", "elbv2", "dynamodb", "s3")'),
    action: z.string().describe('AWS API action name (e.g., "DescribeServices", "DescribeDBInstances", "DescribeTargetHealth"). Must be read-only (Describe/Get/List/Query).'),
    params: z.record(z.unknown()).optional().default({}).describe('API call parameters as a JSON object (e.g., {"cluster": "prod", "services": ["api"]})'),
    region: z.string().optional().describe('AWS region override (e.g., "us-east-1"). Defaults to the integration\'s region. Use when a resource lives in a different region than the integration default — DynamoDB tables, S3 buckets, CloudWatch logs, etc. are region-scoped.'),
});
function zodToInputSchema(schema: z.ZodTypeAny) {
    const { $schema: _, ...rest } = zodToJsonSchema(schema);
    return rest;
}
export const AWS_API_CALL_TOOL = {
    name: 'aws_api_call',
    maxResultChars: 20_000,
    isConcurrencySafe: true,
    description: `Make a read-only AWS API call to ANY AWS service. Supports Describe*, Get*, List*, Query*, Search*, Lookup*, BatchGet*, Head*, Check*, Filter* actions. Write operations are blocked.

Examples:
- aws_api_call("ecs", "DescribeServices", {"cluster": "prod", "services": ["api"]})
- aws_api_call("rds", "DescribeDBInstances", {"DBInstanceIdentifier": "mydb"})
- aws_api_call("elbv2", "DescribeTargetHealth", {"TargetGroupArn": "arn:..."})
- aws_api_call("elasticache", "DescribeCacheClusters", {})
- aws_api_call("s3", "ListBuckets", {})
- aws_api_call("dynamodb", "DescribeTable", {"TableName": "my-table"})
- aws_api_call("eks", "DescribeCluster", {"name": "my-cluster"})
- aws_api_call("route53", "ListHostedZones", {})
- aws_api_call("cloudfront", "ListDistributions", {})
- aws_api_call("sns", "ListTopics", {})

Region: defaults to the integration's configured region. AWS resources are region-scoped (DynamoDB tables, S3 buckets, CloudWatch logs, ECS clusters, RDS, Lambda, etc.) — if a resource is in a different region, pass region as a 4th arg or top-level field. If a Describe/Get returns ResourceNotFoundException, try other plausible regions (us-east-1, us-west-2) before concluding the resource doesn't exist.
- aws_api_call("dynamodb", "DescribeTable", {"TableName": "my-table"}, "us-east-1")

Available services: ecs, ec2, lambda, rds, elasticache, elbv2, apigateway, apigatewayv2, sns, sqs, dynamodb, s3, cloudwatch, logs, cloudtrail, cloudfront, route53, eks, eventbridge, sts, codecommit`,
    inputSchema: zodToInputSchema(awsApiCallInputSchema),
};
// Client cache to avoid re-creating per call within the same investigation
const clientCache = new Map();

/** Test seam: override dynamic SDK imports without referencing @aws-sdk in tests (AC-050). */
type AwsSdkModule = Record<string, unknown>;
type AwsClientInstance = { send: (command: unknown) => Promise<Record<string, unknown>> };
type AwsClientConstructor = new (config: {
    region: string;
    credentials: {
        accessKeyId?: string;
        secretAccessKey?: string;
        sessionToken?: string;
    };
}) => AwsClientInstance;
type AwsCommandConstructor = new (input: Record<string, unknown>) => unknown;

let testSdkImportFn: ((pkg: string) => Promise<AwsSdkModule>) | undefined;

export function setAwsSdkImportForTests(
    fn: ((pkg: string) => Promise<AwsSdkModule>) | undefined,
): void {
    testSdkImportFn = fn;
}

async function loadSdkModule(pkg: string): Promise<AwsSdkModule> {
    if (testSdkImportFn) {
        return testSdkImportFn(pkg);
    }
    return import(pkg);
}

function asClientConstructor(value: unknown, label: string): AwsClientConstructor {
    if (typeof value !== 'function') {
        throw new Error(`${label} is not constructable`);
    }
    return value as AwsClientConstructor;
}

function asCommandConstructor(value: unknown, label: string): AwsCommandConstructor {
    if (typeof value !== 'function') {
        throw new Error(`${label} is not constructable`);
    }
    return value as AwsCommandConstructor;
}

function buildCacheKey(service: string, region: string, accessKeyId: string) {
    return `${service}:${region}:${accessKeyId}`;
}
async function resolveClient(service: string, credentials: CloudCredentials) {
    const entry = getServiceEntry(service);
    const cacheKey = buildCacheKey(service, credentials.region, credentials.credentials['accessKeyId'] ?? '');
    // Dynamic import of the SDK package
    const mod = await loadSdkModule(entry.pkg);
    const ClientClass = asClientConstructor(mod[entry.client], `Client class "${entry.client}"`);
    let client = clientCache.get(cacheKey);
    if (!client) {
        client = new ClientClass({
            region: credentials.region,
            credentials: {
                accessKeyId: credentials.credentials['accessKeyId'],
                secretAccessKey: credentials.credentials['secretAccessKey'],
                sessionToken: credentials.credentials['sessionToken'],
            },
        });
        clientCache.set(cacheKey, client);
    }
    return { client, commandClass: resolveCommand(mod, service) };
}
function resolveCommand(mod: Record<string, unknown>, _service: string) {
    // AWS SDK v3 convention: every command is exported as {Action}Command
    // We return a generic handler that will construct the right command dynamically
    return class DynamicCommand {
        input;
        constructor(input: Record<string, unknown>) {
            this.input = input;
        }
        static __mod = mod;
    };
}
export function createAwsApiToolHandler(credentials: CloudCredentials): (name: string, input: Record<string, unknown>) => Promise<string | null> {
    return async (name, input) => {
        if (name !== 'aws_api_call')
            return null;
        const validated = awsApiCallInputSchema.parse(input);
        // Security: validate read-only
        validateAwsApiCall(validated.service, validated.action);
        const entry = getServiceEntry(validated.service);
        const region = validated.region ?? credentials.region;
        const cacheKey = buildCacheKey(validated.service, region, credentials.credentials['accessKeyId'] ?? '');
        // Dynamic import
        const mod = await loadSdkModule(entry.pkg);
        // Find the command class: {Action}Command
        const commandName = `${validated.action}Command`;
        if (mod[commandName] == null) {
            throw new Error(`Unknown action "${validated.action}" for service "${validated.service}". Command "${commandName}" not found in SDK package.`);
        }
        const CommandClass = asCommandConstructor(mod[commandName], `Command "${commandName}"`);
        // Get or create client
        const ClientClass = asClientConstructor(mod[entry.client], `Client class "${entry.client}"`);
        let client = clientCache.get(cacheKey) as AwsClientInstance | undefined;
        if (!client) {
            client = new ClientClass({
                region,
                credentials: {
                    accessKeyId: credentials.credentials['accessKeyId'],
                    secretAccessKey: credentials.credentials['secretAccessKey'],
                    sessionToken: credentials.credentials['sessionToken'],
                },
            });
            clientCache.set(cacheKey, client);
        }
        // Safety: auto-inject Limit on DynamoDB Query to prevent unbounded reads
        const params = { ...validated.params };
        if (validated.service === 'dynamodb' && validated.action === 'Query' && params['Limit'] == null) {
            params['Limit'] = 1000;
        }
        // Execute
        const command = new CommandClass(params);
        const result = await client.send(command);
        // Strip SDK metadata
        const { $metadata: _, ...data } = result;
        return JSON.stringify(data);
    };
}
/**
 * Clear the client cache (useful for testing or credential rotation).
 */
export function clearAwsClientCache(): void {
    clientCache.clear();
}
