import { CloudWatchLogsClient, StartQueryCommand, GetQueryResultsCommand, } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchClient, GetMetricDataCommand, } from '@aws-sdk/client-cloudwatch';
import { ECSClient, DescribeServicesCommand, DescribeClustersCommand, ListServicesCommand, } from '@aws-sdk/client-ecs';
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { resolveLogGroup } from './aws-log-group-resolver.js';
import { restartService, scaleService, rollbackService, runSSMCommand } from './aws-action-executor.js';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';
import type { CloudProvider, CloudCredentials, LogQuery, LogEntry, MetricQuery, MetricDataPoint, ServiceInfo, ResourceAction } from '../../application/ports/cloud-provider.port.js';
function buildAwsCredentials(creds: CloudCredentials) {
    if (!creds.credentials['accessKeyId'])
        return undefined;
    return {
        accessKeyId: creds.credentials['accessKeyId']!,
        secretAccessKey: creds.credentials['secretAccessKey']!,
        sessionToken: creds.credentials['sessionToken'],
    };
}
function buildClientConfig(creds: CloudCredentials): { region: string; credentials: ReturnType<typeof buildAwsCredentials>; endpoint?: string } {
    return {
        region: creds.region,
        credentials: buildAwsCredentials(creds),
        ...(config.cloudProvider.endpoint && { endpoint: config.cloudProvider.endpoint }),
    };
}
export class AWSCloudProvider {
    name = 'aws';
    async queryLogs(creds: CloudCredentials, query: LogQuery): Promise<LogEntry[]> {
        const client = new CloudWatchLogsClient(buildClientConfig(creds));
        const logGroups = resolveLogGroup(query.service);
        const filterExpr = query.filter ? `fields @timestamp, @message | filter @message like /${query.filter}/` : 'fields @timestamp, @message';
        const queryString = `${filterExpr} | sort @timestamp desc | limit ${query.limit ?? 50}`;
        const startResp = await client.send(new StartQueryCommand({
            logGroupNames: logGroups,
            startTime: Math.floor(new Date(query.startTime).getTime() / 1000),
            endTime: Math.floor(new Date(query.endTime).getTime() / 1000),
            queryString,
            limit: query.limit ?? 50,
        }));
        if (!startResp.queryId) {
            return [];
        }
        // Poll for results
        const maxWait = config.cloudProvider.insightsMaxWaitMs;
        const deadline = Date.now() + maxWait;
        while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const resultsResp = await client.send(new GetQueryResultsCommand({ queryId: startResp.queryId }));
            if (resultsResp.status === 'Complete') {
                return (resultsResp.results ?? []).map((row) => {
                    const fields = Object.fromEntries(row.map((f) => [f.field, f.value]));
                    return {
                        timestamp: fields['@timestamp'] ?? new Date().toISOString(),
                        message: fields['@message'] ?? '',
                        level: this.inferLogLevel(fields['@message'] ?? ''),
                        service: query.service,
                    };
                });
            }
            if (resultsResp.status === 'Failed' || resultsResp.status === 'Cancelled') {
                logger.warn({ queryId: startResp.queryId, status: resultsResp.status }, 'CW Logs Insights query failed');
                return [];
            }
        }
        logger.warn({ queryId: startResp.queryId }, 'CW Logs Insights query timed out');
        return [];
    }
    async queryMetrics(creds: CloudCredentials, query: MetricQuery): Promise<MetricDataPoint[]> {
        const client = new CloudWatchClient(buildClientConfig(creds));
        const statMap = {
            Average: 'Average',
            Sum: 'Sum',
            Maximum: 'Maximum',
            Minimum: 'Minimum',
            p99: 'p99',
            p95: 'p95',
        };
        const stat = statMap[query.stat ?? 'Average'] ?? 'Average';
        const resp = await client.send(new GetMetricDataCommand({
            StartTime: new Date(query.startTime),
            EndTime: new Date(query.endTime),
            MetricDataQueries: [
                {
                    Id: 'q1',
                    MetricStat: {
                        Metric: {
                            MetricName: query.metricName,
                            Namespace: query.namespace,
                        },
                        Period: query.period ?? 300,
                        Stat: stat,
                    },
                },
            ],
        }));
        const result = resp.MetricDataResults?.[0];
        if (!result?.Timestamps || !result.Values)
            return [];
        return result.Timestamps.map((ts, idx) => ({
            timestamp: ts.toISOString(),
            value: result.Values![idx] ?? 0,
        }));
    }
    async describeService(creds: CloudCredentials, serviceName: string, region: string): Promise<ServiceInfo> {
        const awsCreds = buildAwsCredentials(creds);
        // Try ECS first
        try {
            const ecsClient = new ECSClient({ region, credentials: awsCreds, ...(config.cloudProvider.endpoint && { endpoint: config.cloudProvider.endpoint }) });
            const clusters = await ecsClient.send(new DescribeClustersCommand({}));
            const clusterArns = clusters.clusters?.map((c) => c.clusterArn).filter(Boolean) ?? ['default'];
            for (const clusterArn of clusterArns) {
                const resp = await ecsClient.send(new DescribeServicesCommand({ cluster: clusterArn, services: [serviceName] }));
                const svc = resp.services?.[0];
                if (svc && svc.status !== 'INACTIVE') {
                    return {
                        name: svc.serviceName ?? serviceName,
                        type: 'container',
                        status: svc.status === 'ACTIVE' ? 'running' : 'degraded',
                        region,
                        metadata: {
                            cluster: clusterArn,
                            taskDefinition: svc.taskDefinition,
                            desiredCount: svc.desiredCount,
                            runningCount: svc.runningCount,
                            pendingCount: svc.pendingCount,
                            launchType: svc.launchType,
                        },
                    };
                }
            }
        }
        catch {
            // ECS not found, try Lambda
        }
        // Try Lambda
        try {
            const lambdaClient = new LambdaClient({ region, credentials: awsCreds, ...(config.cloudProvider.endpoint && { endpoint: config.cloudProvider.endpoint }) });
            const resp = await lambdaClient.send(new GetFunctionCommand({ FunctionName: serviceName }));
            if (resp.Configuration) {
                return {
                    name: resp.Configuration.FunctionName ?? serviceName,
                    type: 'function',
                    status: resp.Configuration.State === 'Active' ? 'running' : 'degraded',
                    region,
                    metadata: {
                        runtime: resp.Configuration.Runtime,
                        memorySize: resp.Configuration.MemorySize,
                        timeout: resp.Configuration.Timeout,
                        lastModified: resp.Configuration.LastModified,
                    },
                };
            }
        }
        catch {
            // Lambda not found, try EC2
        }
        // Try EC2 (by name tag)
        try {
            const ec2Client = new EC2Client({ region, credentials: awsCreds, ...(config.cloudProvider.endpoint && { endpoint: config.cloudProvider.endpoint }) });
            const resp = await ec2Client.send(new DescribeInstancesCommand({
                Filters: [{ Name: 'tag:Name', Values: [serviceName] }],
            }));
            const instance = resp.Reservations?.[0]?.Instances?.[0];
            if (instance) {
                return {
                    name: serviceName,
                    type: 'container',
                    status: instance.State?.Name === 'running' ? 'running' : 'stopped',
                    region,
                    metadata: {
                        instanceId: instance.InstanceId,
                        instanceType: instance.InstanceType,
                        availabilityZone: instance.Placement?.AvailabilityZone,
                    },
                };
            }
        }
        catch {
            // EC2 not found
        }
        return {
            name: serviceName,
            type: 'other',
            status: 'unknown',
            region,
        };
    }
    async executeAction(creds: CloudCredentials, action: ResourceAction) {
        const params = action.params ?? {};
        switch (action.action) {
            case 'restart_service':
                return restartService(creds, params);
            case 'scale_service':
                return scaleService(creds, params);
            case 'rollback_service':
                return rollbackService(creds, params);
            case 'run_command':
                return runSSMCommand(creds, params);
            default:
                return { success: false, output: `Unknown action: ${action.action}` };
        }
    }
    async testConnection(creds: CloudCredentials): Promise<boolean> {
        try {
            const client = new STSClient(buildClientConfig(creds));
            await client.send(new GetCallerIdentityCommand({}));
            return true;
        }
        catch {
            return false;
        }
    }
    inferLogLevel(message: string) {
        const lower = message.toLowerCase();
        if (lower.includes('error') || lower.includes('exception') || lower.includes('fatal'))
            return 'error';
        if (lower.includes('warn'))
            return 'warn';
        if (lower.includes('debug'))
            return 'debug';
        return 'info';
    }
}
