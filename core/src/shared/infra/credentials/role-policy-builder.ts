import type { AgentRole } from '../../domain/types.js';

/**
 * Session policy for investigation agents — broad read-only access.
 * Write operations are blocked at the session level (Deny statement).
 * The aws_api_call tool handler also validates read-only actions before execution.
 *
 * All investigation agents (log_analyst, metric_analyst, infra_inspector, etc.)
 * share the same read-only policy since they all have aws_api_call and need
 * cross-service discovery (e.g., log_analyst may need to list ECS services
 * to find the right log group).
 */
const INVESTIGATION_READ_ONLY_POLICY = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
        {
            Sid: 'AllowReadOnly',
            Effect: 'Allow',
            Action: [
                // CloudWatch Logs
                'logs:Describe*', 'logs:Get*', 'logs:Filter*', 'logs:Start*', 'logs:Stop*',
                // CloudWatch Metrics
                'cloudwatch:Describe*', 'cloudwatch:Get*', 'cloudwatch:List*',
                // ECS
                'ecs:Describe*', 'ecs:List*',
                // EC2
                'ec2:Describe*',
                // Lambda
                'lambda:Get*', 'lambda:List*',
                // RDS
                'rds:Describe*', 'rds:List*',
                // ElastiCache
                'elasticache:Describe*', 'elasticache:List*',
                // ELB
                'elasticloadbalancing:Describe*',
                // API Gateway
                'apigateway:GET',
                // SNS
                'sns:List*', 'sns:Get*',
                // SQS
                'sqs:List*', 'sqs:Get*',
                // DynamoDB
                'dynamodb:Describe*', 'dynamodb:List*',
                // S3
                's3:List*', 's3:Get*',
                // EKS
                'eks:Describe*', 'eks:List*',
                // CloudFront
                'cloudfront:List*', 'cloudfront:Get*',
                // Route53
                'route53:List*', 'route53:Get*',
                // EventBridge
                'events:List*', 'events:Describe*',
                // CloudTrail
                'cloudtrail:Lookup*', 'cloudtrail:Get*', 'cloudtrail:Describe*',
                // SSM
                'ssm:Describe*', 'ssm:Get*', 'ssm:List*',
                // CodeCommit
                'codecommit:Get*', 'codecommit:List*', 'codecommit:Describe*', 'codecommit:BatchGet*',
                // STS
                'sts:GetCallerIdentity',
            ],
            Resource: '*',
        },
        {
            Sid: 'DenyDestructive',
            Effect: 'Deny',
            Action: [
                'ec2:RunInstances', 'ec2:TerminateInstances', 'ec2:StopInstances',
                'rds:DeleteDBInstance', 'rds:StopDBInstance',
                's3:DeleteBucket', 's3:DeleteObject', 's3:PutObject',
                'ecs:DeleteService', 'ecs:StopTask', 'ecs:UpdateService',
                'lambda:DeleteFunction', 'lambda:UpdateFunctionCode', 'lambda:InvokeFunction',
                'dynamodb:DeleteTable', 'dynamodb:PutItem', 'dynamodb:DeleteItem',
            ],
            Resource: '*',
        },
    ],
});

const REMEDIATOR_POLICY = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
        {
            Effect: 'Allow',
            Action: [
                'ecs:UpdateService', 'ecs:DescribeServices', 'ecs:DescribeTaskDefinition',
                'ecs:RegisterTaskDefinition', 'ecs:ListTaskDefinitions',
                'ssm:SendCommand', 'ssm:GetCommandInvocation', 'ssm:ListCommandInvocations',
                'lambda:UpdateFunctionConfiguration', 'lambda:UpdateFunctionCode',
            ],
            Resource: '*',
        },
    ],
});

const COORDINATOR_POLICY = JSON.stringify({
    Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Action: ['sts:GetCallerIdentity'], Resource: '*' }],
});

export function buildSessionPolicy(agentRole: AgentRole): string {
    if (agentRole === 'remediator') return REMEDIATOR_POLICY;
    if (agentRole === 'coordinator') return COORDINATOR_POLICY;
    return INVESTIGATION_READ_ONLY_POLICY;
}
