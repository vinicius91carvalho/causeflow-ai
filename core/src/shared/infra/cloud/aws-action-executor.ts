import { ECSClient, UpdateServiceCommand, DescribeServicesCommand, DescribeTaskDefinitionCommand, RegisterTaskDefinitionCommand, ListTaskDefinitionsCommand, } from '@aws-sdk/client-ecs';
import { SSMClient, SendCommandCommand, GetCommandInvocationCommand } from '@aws-sdk/client-ssm';
import { logger } from '../logger.js';
import { config } from '../../config/index.js';
import type { CloudCredentials } from '../../application/ports/cloud-provider.port.js';
function buildAwsCredentials(creds: CloudCredentials) {
    if (!creds.credentials['accessKeyId'])
        return undefined;
    return {
        accessKeyId: creds.credentials['accessKeyId'],
        secretAccessKey: creds.credentials['secretAccessKey'] ?? '',
        ...(creds.credentials['sessionToken'] && { sessionToken: creds.credentials['sessionToken'] }),
    };
}
function buildClientConfig(creds: CloudCredentials) {
    return {
        region: creds.region,
        credentials: buildAwsCredentials(creds),
        ...(config.cloudProvider.endpoint && { endpoint: config.cloudProvider.endpoint }),
    };
}
export async function restartService(creds: CloudCredentials, params: Record<string, unknown>) {
    const cluster = (params['cluster'] ?? 'default') as string;
    const service = params['service'] as string | undefined;
    if (!service)
        return { success: false, output: 'Missing required param: service' };
    const client = new ECSClient(buildClientConfig(creds));
    await client.send(new UpdateServiceCommand({
        cluster,
        service,
        forceNewDeployment: true,
    }));
    logger.info({ cluster, service }, 'ECS service restart triggered');
    return { success: true, output: `Force new deployment triggered for ${service} in cluster ${cluster}` };
}
export async function scaleService(creds: CloudCredentials, params: Record<string, unknown>) {
    const cluster = (params['cluster'] ?? 'default') as string;
    const service = params['service'] as string | undefined;
    const desiredCount = params['desiredCount'] as number | undefined;
    if (!service || desiredCount === undefined) {
        return { success: false, output: 'Missing required params: service, desiredCount' };
    }
    const client = new ECSClient(buildClientConfig(creds));
    await client.send(new UpdateServiceCommand({
        cluster,
        service,
        desiredCount,
    }));
    logger.info({ cluster, service, desiredCount }, 'ECS service scaled');
    return { success: true, output: `Scaled ${service} to ${desiredCount} tasks` };
}
export async function rollbackService(creds: CloudCredentials, params: Record<string, unknown>) {
    const cluster = (params['cluster'] ?? 'default') as string;
    const service = params['service'] as string | undefined;
    if (!service)
        return { success: false, output: 'Missing required param: service' };
    const ecsClient = new ECSClient(buildClientConfig(creds));
    // Get current service to find task definition
    const describeResp = await ecsClient.send(new DescribeServicesCommand({ cluster, services: [service] }));
    const svc = describeResp.services?.[0];
    if (!svc?.taskDefinition) {
        return { success: false, output: `Service ${service} not found or has no task definition` };
    }
    // Get task definition family to find previous revision
    const taskDefResp = await ecsClient.send(new DescribeTaskDefinitionCommand({ taskDefinition: svc.taskDefinition }));
    const family = taskDefResp.taskDefinition?.family;
    if (!family) {
        return { success: false, output: 'Could not determine task definition family' };
    }
    // List previous revisions
    const listResp = await ecsClient.send(new ListTaskDefinitionsCommand({ familyPrefix: family, sort: 'DESC', maxResults: 2 }));
    const previousArn = listResp.taskDefinitionArns?.[1];
    if (!previousArn) {
        return { success: false, output: 'No previous task definition revision found for rollback' };
    }
    // Update service to previous task definition
    await ecsClient.send(new UpdateServiceCommand({ cluster, service, taskDefinition: previousArn }));
    logger.info({ cluster, service, previousArn }, 'ECS service rolled back');
    return { success: true, output: `Rolled back ${service} to ${previousArn}` };
}
export async function runSSMCommand(creds: CloudCredentials, params: Record<string, unknown>) {
    const instanceIds = params['instanceIds'] as string[] | undefined;
    const command = params['command'] as string | undefined;
    if (!instanceIds?.length || !command) {
        return { success: false, output: 'Missing required params: instanceIds, command' };
    }
    const client = new SSMClient(buildClientConfig(creds));
    const timeoutSeconds = config.cloudProvider.ssmCommandTimeoutS;
    const sendResp = await client.send(new SendCommandCommand({
        InstanceIds: instanceIds,
        DocumentName: 'AWS-RunShellScript',
        Parameters: { commands: [command] },
        TimeoutSeconds: timeoutSeconds,
    }));
    const commandId = sendResp.Command?.CommandId;
    if (!commandId) {
        return { success: false, output: 'Failed to send SSM command' };
    }
    // Poll for result
    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
            const invocation = await client.send(new GetCommandInvocationCommand({
                CommandId: commandId,
                InstanceId: instanceIds[0],
            }));
            if (invocation.Status === 'Success') {
                return { success: true, output: invocation.StandardOutputContent ?? 'Command completed' };
            }
            if (invocation.Status === 'Failed' || invocation.Status === 'Cancelled' || invocation.Status === 'TimedOut') {
                return { success: false, output: invocation.StandardErrorContent ?? `Command ${invocation.Status}` };
            }
        }
        catch {
            // InvocationDoesNotExist — command still pending
        }
    }
    return { success: false, output: `SSM command timed out after ${timeoutSeconds}s` };
}
