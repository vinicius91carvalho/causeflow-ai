import { config } from '../../config/index.js';
import { dispatchFargateTask } from './ecs-client.js';
import { createRelayToken } from '../relay/investigation-relay-auth.js';
import { logger } from '../logger.js';

export interface DispatchInvestigationParams {
    incidentId: string;
    tenantId: string;
    suggestedAgents: string[];
    /** Worker mode: 'investigate' (default) or 'followup' (skip investigation, enter idle for Q&A) */
    mode?: 'investigate' | 'followup';
}

export async function dispatchInvestigation(params: DispatchInvestigationParams): Promise<string | undefined> {
    logger.info({ incidentId: params.incidentId, tenantId: params.tenantId, agents: params.suggestedAgents }, 'Dispatching investigation to Fargate');
    const environmentOverrides = [
        // Investigation-specific
        { name: 'INCIDENT_ID', value: params.incidentId },
        { name: 'TENANT_ID', value: params.tenantId },
        { name: 'SUGGESTED_AGENTS', value: params.suggestedAgents.join(',') },
        // DynamoDB
        { name: 'DYNAMODB_TABLE_NAME', value: config.aws.tableName },
        ...(config.aws.dynamoEndpoint ? [{ name: 'DYNAMODB_ENDPOINT', value: config.aws.dynamoEndpoint }] : []),
        // SQS
        ...(config.aws.sqsEndpoint ? [{ name: 'SQS_ENDPOINT', value: config.aws.sqsEndpoint }] : []),
        ...(config.sqs.remediationQueueUrl ? [{ name: 'SQS_REMEDIATION_QUEUE_URL', value: config.sqs.remediationQueueUrl }] : []),
        ...(config.sqs.investigationQueueUrl ? [{ name: 'SQS_INVESTIGATION_QUEUE_URL', value: config.sqs.investigationQueueUrl }] : []),
        // AWS
        { name: 'AWS_REGION', value: config.aws.region },
        ...(config.sts.roleArn ? [{ name: 'AWS_ROLE_ARN', value: config.sts.roleArn }] : []),
        ...(config.sts.stsEndpoint ? [{ name: 'STS_ENDPOINT', value: config.sts.stsEndpoint }] : []),
        ...(config.cloudProvider.endpoint ? [{ name: 'CLOUD_PROVIDER_ENDPOINT', value: config.cloudProvider.endpoint }] : []),
        // LLM
        { name: 'ANTHROPIC_API_KEY', value: config.anthropic.apiKey },
        ...(config.anthropic.baseUrl ? [{ name: 'ANTHROPIC_BASE_URL', value: config.anthropic.baseUrl }] : []),
        { name: 'ANTHROPIC_INVESTIGATION_MODEL', value: config.anthropic.investigationModel },
        { name: 'ANTHROPIC_SYNTHESIS_MODEL', value: config.anthropic.synthesisModel },
        // Composio
        ...(config.composio.apiKey ? [{ name: 'COMPOSIO_API_KEY', value: config.composio.apiKey }] : []),
        // KMS
        ...(config.kms.endpoint ? [{ name: 'KMS_ENDPOINT', value: config.kms.endpoint }] : []),
        { name: 'KMS_TOKEN_ENCRYPTION_KEY_ID', value: config.kms.tokenEncryptionKeyId },
        // PTC
        { name: 'ENABLE_PROGRAMMATIC_TOOL_CALLING', value: String(config.ptc.enabled) },
        // Hindsight (agent memory — core for investigation)
        { name: 'HINDSIGHT_BASE_URL', value: config.hindsight.baseUrl },
        ...(config.hindsight.apiKey ? [{ name: 'HINDSIGHT_API_KEY', value: config.hindsight.apiKey }] : []),
        // SQS progress queue (for worker → API server progress notifications)
        ...(config.sqs.progressQueueUrl ? [{ name: 'SQS_PROGRESS_QUEUE_URL', value: config.sqs.progressQueueUrl }] : []),
        // Investigation relay (bidirectional WS for user ↔ agent communication)
        // Prefer internal URL (ALB direct, avoids WAF/CloudFront) for Fargate→API relay
        ...((process.env['INVESTIGATION_RELAY_URL_INTERNAL'] || process.env['INVESTIGATION_RELAY_URL']) ? [
            { name: 'INVESTIGATION_RELAY_URL', value: process.env['INVESTIGATION_RELAY_URL_INTERNAL'] || process.env['INVESTIGATION_RELAY_URL']! },
            { name: 'INVESTIGATION_RELAY_TOKEN', value: await createRelayToken({ tenantId: params.tenantId, incidentId: params.incidentId, role: 'worker' }) },
        ] : []),
        // Worker mode
        ...(params.mode ? [{ name: 'WORKER_MODE', value: params.mode }] : []),
        { name: 'NODE_ENV', value: config.env },
        { name: 'LOG_LEVEL', value: config.logLevel },
    ];
    return dispatchFargateTask({
        cluster: config.ecs.cluster,
        taskDefinition: config.ecs.investigationTaskDefinition,
        environmentOverrides,
        subnets: config.ecs.subnetIds,
        securityGroups: config.ecs.securityGroupIds,
    });
}
