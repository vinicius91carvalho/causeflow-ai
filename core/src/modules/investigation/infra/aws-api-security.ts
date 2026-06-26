/**
 * AWS API Security Layer — validates that only read-only actions are allowed.
 *
 * Defense-in-depth:
 * 1. READ_ONLY_PREFIXES allowlist (this file)
 * 2. BLOCKED_ACTIONS explicit denylist (this file)
 * 3. STS session policy (IAM side) — denies writes even if 1+2 are bypassed
 */
const READ_ONLY_PREFIXES = [
    'Describe',
    'Get',
    'List',
    'Query',
    'Search',
    'Lookup',
    'BatchGet',
    'Head',
    'Check',
    'Filter',
];
const BLOCKED_ACTIONS = new Set([
    // EC2
    'TerminateInstances',
    'StopInstances',
    'RunInstances',
    'ModifyInstanceAttribute',
    // S3
    'DeleteBucket',
    'DeleteObject',
    'PutObject',
    'PutBucketPolicy',
    // RDS
    'DeleteDBInstance',
    'StopDBInstance',
    'RebootDBInstance',
    'ModifyDBInstance',
    'DeleteDBCluster',
    // ECS
    'DeleteService',
    'StopTask',
    'DeleteCluster',
    'UpdateService',
    'RegisterTaskDefinition',
    'DeregisterTaskDefinition',
    // Lambda
    'DeleteFunction',
    'UpdateFunctionCode',
    'UpdateFunctionConfiguration',
    'InvokeFunction',
    // IAM (should never reach here but defense-in-depth)
    'CreateRole',
    'DeleteRole',
    'AttachRolePolicy',
    'DetachRolePolicy',
    'PutRolePolicy',
    'CreateUser',
    'DeleteUser',
    // SQS
    'DeleteQueue',
    'PurgeQueue',
    'SendMessage',
    // SNS
    'DeleteTopic',
    'Publish',
    'Subscribe',
    // DynamoDB
    'DeleteTable',
    'PutItem',
    'DeleteItem',
    'UpdateItem',
    'CreateTable',
    'Scan',
    // ElastiCache
    'DeleteCacheCluster',
    'DeleteReplicationGroup',
    'ModifyCacheCluster',
    // EKS
    'DeleteCluster',
    'DeleteNodegroup',
    // CloudFront
    'DeleteDistribution',
    'UpdateDistribution',
    // Route53
    'DeleteHostedZone',
    'ChangeResourceRecordSets',
    // EventBridge
    'DeleteRule',
    'PutRule',
    'PutEvents',
    // API Gateway
    'DeleteRestApi',
    'DeleteApi',
    // General
    'CreateStack',
    'DeleteStack',
    'UpdateStack',
]);
export function isReadOnlyAction(service: string, action: string): boolean {
    if (BLOCKED_ACTIONS.has(action)) {
        return false;
    }
    return READ_ONLY_PREFIXES.some((prefix) => action.startsWith(prefix));
}
export function validateAwsApiCall(service: string, action: string): void {
    if (!service || typeof service !== 'string') {
        throw new Error('Invalid AWS service name');
    }
    if (!action || typeof action !== 'string') {
        throw new Error('Invalid AWS action name');
    }
    if (!isReadOnlyAction(service, action)) {
        throw new Error(`Blocked: "${action}" on service "${service}" is not a read-only action. Only Describe/Get/List/Query operations are allowed.`);
    }
}
