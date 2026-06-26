import { ECSClient } from '@aws-sdk/client-ecs';
export declare function getECSClient(): ECSClient;
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
export declare function dispatchFargateTask(params: FargateTaskParams): Promise<string | undefined>;
