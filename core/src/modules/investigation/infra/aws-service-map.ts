
export interface AwsServiceEntry {
    pkg: string;
    client: string;
}

/**
 * Maps AWS service short names to their SDK v3 client package + class name.
 * Used by aws-api-tool.ts to dynamically resolve clients.
 */
export const AWS_SERVICE_MAP = {
    ecs: { pkg: '@aws-sdk/client-ecs', client: 'ECSClient' },
    ec2: { pkg: '@aws-sdk/client-ec2', client: 'EC2Client' },
    lambda: { pkg: '@aws-sdk/client-lambda', client: 'LambdaClient' },
    rds: { pkg: '@aws-sdk/client-rds', client: 'RDSClient' },
    elasticache: { pkg: '@aws-sdk/client-elasticache', client: 'ElastiCacheClient' },
    elbv2: { pkg: '@aws-sdk/client-elastic-load-balancing-v2', client: 'ElasticLoadBalancingV2Client' },
    apigateway: { pkg: '@aws-sdk/client-api-gateway', client: 'APIGatewayClient' },
    apigatewayv2: { pkg: '@aws-sdk/client-apigatewayv2', client: 'ApiGatewayV2Client' },
    sns: { pkg: '@aws-sdk/client-sns', client: 'SNSClient' },
    sqs: { pkg: '@aws-sdk/client-sqs', client: 'SQSClient' },
    dynamodb: { pkg: '@aws-sdk/client-dynamodb', client: 'DynamoDBClient' },
    s3: { pkg: '@aws-sdk/client-s3', client: 'S3Client' },
    cloudwatch: { pkg: '@aws-sdk/client-cloudwatch', client: 'CloudWatchClient' },
    logs: { pkg: '@aws-sdk/client-cloudwatch-logs', client: 'CloudWatchLogsClient' },
    cloudtrail: { pkg: '@aws-sdk/client-cloudtrail', client: 'CloudTrailClient' },
    cloudfront: { pkg: '@aws-sdk/client-cloudfront', client: 'CloudFrontClient' },
    route53: { pkg: '@aws-sdk/client-route-53', client: 'Route53Client' },
    eks: { pkg: '@aws-sdk/client-eks', client: 'EKSClient' },
    eventbridge: { pkg: '@aws-sdk/client-eventbridge', client: 'EventBridgeClient' },
    sts: { pkg: '@aws-sdk/client-sts', client: 'STSClient' },
    codecommit: { pkg: '@aws-sdk/client-codecommit', client: 'CodeCommitClient' },
};
export function getServiceEntry(service: string): AwsServiceEntry {
    const entry = (AWS_SERVICE_MAP as Record<string, AwsServiceEntry>)[service.toLowerCase()];
    if (!entry) {
        const available = Object.keys(AWS_SERVICE_MAP).join(', ');
        throw new Error(`Unknown AWS service "${service}". Available: ${available}`);
    }
    return entry;
}
