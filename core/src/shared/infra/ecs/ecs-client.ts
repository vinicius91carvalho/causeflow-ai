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

let client: ECSClient | null = null;
export function getECSClient(): ECSClient {
    if (!client) {
        client = new ECSClient({
            region: config.aws.region,
            ...(config.ecs.endpoint && { endpoint: config.ecs.endpoint }),
        });
    }
    return client;
}
export async function dispatchFargateTask(params: FargateTaskParams): Promise<string | undefined> {
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
    logger.info({ cluster: params.cluster, taskDefinition: params.taskDefinition }, 'Dispatching Fargate investigation task');
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
