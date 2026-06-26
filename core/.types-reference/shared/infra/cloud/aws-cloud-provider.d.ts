import type { CloudProvider, CloudCredentials, LogQuery, LogEntry, MetricQuery, MetricDataPoint, ServiceInfo, ResourceAction } from '../../application/ports/cloud-provider.port.js';
export declare class AWSCloudProvider implements CloudProvider {
    readonly name = "aws";
    queryLogs(creds: CloudCredentials, query: LogQuery): Promise<LogEntry[]>;
    queryMetrics(creds: CloudCredentials, query: MetricQuery): Promise<MetricDataPoint[]>;
    describeService(creds: CloudCredentials, serviceName: string, region: string): Promise<ServiceInfo>;
    executeAction(creds: CloudCredentials, action: ResourceAction): Promise<{
        success: boolean;
        output?: string;
    }>;
    testConnection(creds: CloudCredentials): Promise<boolean>;
    private inferLogLevel;
}
