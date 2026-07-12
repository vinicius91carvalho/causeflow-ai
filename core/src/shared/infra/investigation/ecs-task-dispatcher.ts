/**
 * ECS investigation task dispatcher — AWS runtime only.
 *
 * Dynamically imported ONLY when `config.ecs.cluster` is set (AWS mode).
 * In the OSS local runtime this file is never loaded, so the
 * `@aws-sdk/client-ecs` import never executes in OSS mode.
 *
 * @see local-task-dispatcher.ts for the OSS equivalent.
 */
import { ECSClient, RunTaskCommand, type RunTaskCommandInput } from '@aws-sdk/client-ecs';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';

export interface FargateTaskParams {
  cluster: string;
  taskDefinition: string;
  environmentOverrides: Array<{
    name: string;
    value: string;
  }>;
  subnets?: string[];
  securityGroups?: string[];
}

export interface DispatchInvestigationParams {
  incidentId: string;
  tenantId: string;
  suggestedAgents: string[];
  /** Worker mode: 'investigate' (default) or 'followup' (skip investigation, enter idle for Q&A) */
  mode?: 'investigate' | 'followup';
}

let client: ECSClient | null = null;

function getECSClient(): ECSClient {
  if (!client) {
    client = new ECSClient({
      region: config.aws.region,
      ...(config.ecs.endpoint && { endpoint: config.ecs.endpoint }),
    });
  }
  return client;
}

async function dispatchFargateTask(params: FargateTaskParams): Promise<string | undefined> {
  const ecs = getECSClient();
  const input: RunTaskCommandInput = {
    cluster: params.cluster,
    taskDefinition: params.taskDefinition,
    launchType: 'FARGATE',
    count: 1,
    overrides: {
      containerOverrides: [
        {
          name: 'investigation-worker',
          environment: params.environmentOverrides,
        },
      ],
    },
    ...(params.subnets?.length && {
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: params.subnets,
          securityGroups: params.securityGroups,
          assignPublicIp: 'DISABLED' as const,
        },
      },
    }),
  };
  logger.info(
    { cluster: params.cluster, taskDefinition: params.taskDefinition },
    'Dispatching Fargate investigation task',
  );
  const result = await ecs.send(new RunTaskCommand(input));
  const taskArn = result.tasks?.[0]?.taskArn;
  const failures = result.failures ?? [];
  if (failures.length > 0) {
    logger.error({ failures }, 'Fargate task dispatch had failures');
    throw new Error(`Fargate task dispatch failed: ${failures[0]?.reason ?? 'unknown'}`);
  }
  logger.info({ taskArn }, 'Fargate investigation task dispatched');
  return taskArn;
}

export async function dispatchInvestigation(
  params: DispatchInvestigationParams,
): Promise<string | undefined> {
  logger.info(
    {
      incidentId: params.incidentId,
      tenantId: params.tenantId,
      agents: params.suggestedAgents,
    },
    'Dispatching investigation to Fargate',
  );
  const environmentOverrides = [
    // Investigation-specific
    { name: 'INCIDENT_ID', value: params.incidentId },
    { name: 'TENANT_ID', value: params.tenantId },
    {
      name: 'SUGGESTED_AGENTS',
      value: params.suggestedAgents.join(','),
    },
    // DynamoDB
    { name: 'DYNAMODB_TABLE_NAME', value: config.aws.tableName },
    ...(config.aws.dynamoEndpoint
      ? [{ name: 'DYNAMODB_ENDPOINT', value: config.aws.dynamoEndpoint }]
      : []),
    // SQS
    ...(config.aws.sqsEndpoint ? [{ name: 'SQS_ENDPOINT', value: config.aws.sqsEndpoint }] : []),
    ...(config.sqs.remediationQueueUrl
      ? [
          {
            name: 'SQS_REMEDIATION_QUEUE_URL',
            value: config.sqs.remediationQueueUrl,
          },
        ]
      : []),
    ...(config.sqs.investigationQueueUrl
      ? [
          {
            name: 'SQS_INVESTIGATION_QUEUE_URL',
            value: config.sqs.investigationQueueUrl,
          },
        ]
      : []),
    // AWS
    { name: 'AWS_REGION', value: config.aws.region },
    ...(config.sts.roleArn ? [{ name: 'AWS_ROLE_ARN', value: config.sts.roleArn }] : []),
    ...(config.sts.stsEndpoint ? [{ name: 'STS_ENDPOINT', value: config.sts.stsEndpoint }] : []),
    ...(config.cloudProvider.endpoint
      ? [
          {
            name: 'CLOUD_PROVIDER_ENDPOINT',
            value: config.cloudProvider.endpoint,
          },
        ]
      : []),
    // LLM
    { name: 'ANTHROPIC_API_KEY', value: config.anthropic.apiKey },
    ...(config.anthropic.baseUrl
      ? [{ name: 'ANTHROPIC_BASE_URL', value: config.anthropic.baseUrl }]
      : []),
    {
      name: 'ANTHROPIC_INVESTIGATION_MODEL',
      value: config.anthropic.investigationModel,
    },
    {
      name: 'ANTHROPIC_SYNTHESIS_MODEL',
      value: config.anthropic.synthesisModel,
    },
    // Composio
    ...(config.composio.apiKey
      ? [{ name: 'COMPOSIO_API_KEY', value: config.composio.apiKey }]
      : []),
    // KMS
    ...(config.kms.endpoint ? [{ name: 'KMS_ENDPOINT', value: config.kms.endpoint }] : []),
    {
      name: 'KMS_TOKEN_ENCRYPTION_KEY_ID',
      value: config.kms.tokenEncryptionKeyId,
    },
    // PTC
    {
      name: 'ENABLE_PROGRAMMATIC_TOOL_CALLING',
      value: String(config.ptc.enabled),
    },
    // Hindsight (agent memory — core for investigation)
    { name: 'HINDSIGHT_BASE_URL', value: config.hindsight.baseUrl },
    ...(config.hindsight.apiKey
      ? [{ name: 'HINDSIGHT_API_KEY', value: config.hindsight.apiKey }]
      : []),
    // SQS progress queue (for worker → API server progress notifications)
    ...(config.sqs.progressQueueUrl
      ? [
          {
            name: 'SQS_PROGRESS_QUEUE_URL',
            value: config.sqs.progressQueueUrl,
          },
        ]
      : []),
    // Investigation relay (bidirectional WS for user ↔ agent communication)
    // Prefer internal URL (ALB direct, avoids WAF/CloudFront) for Fargate→API relay
    ...(process.env['INVESTIGATION_RELAY_URL_INTERNAL'] || process.env['INVESTIGATION_RELAY_URL']
      ? [
          {
            name: 'INVESTIGATION_RELAY_URL',
            value:
              process.env['INVESTIGATION_RELAY_URL_INTERNAL'] ||
              process.env['INVESTIGATION_RELAY_URL']!,
          },
          {
            name: 'INVESTIGATION_RELAY_TOKEN',
            value: '',
          },
        ]
      : []),
    // Worker mode
    ...(params.mode ? [{ name: 'WORKER_MODE', value: params.mode }] : []),
    { name: 'NODE_ENV', value: config.env },
    { name: 'LOG_LEVEL', value: config.logLevel },
  ];

  // Create relay token if needed (deferred to avoid top-level await
  // in this module — the old ecs/task-dispatcher.ts had the same pattern)
  // Token creation is skipped here; the worker reads relay token from env.
  return dispatchFargateTask({
    cluster: config.ecs.cluster,
    taskDefinition: config.ecs.investigationTaskDefinition,
    environmentOverrides,
    subnets: config.ecs.subnetIds,
    securityGroups: config.ecs.securityGroupIds,
  });
}
