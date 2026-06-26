import type { CloudProvider, CloudCredentials, LogQuery, LogEntry, MetricQuery, MetricDataPoint, ServiceInfo, ResourceAction } from '../../application/ports/cloud-provider.port.js';
export declare class StubCloudProvider implements CloudProvider {
    readonly name = "stub";
    queryLogs(_creds: CloudCredentials, query: LogQuery): Promise<LogEntry[]>;
    queryMetrics(_creds: CloudCredentials, query: MetricQuery): Promise<MetricDataPoint[]>;
    describeService(_creds: CloudCredentials, serviceName: string, region: string): Promise<ServiceInfo>;
    executeAction(_creds: CloudCredentials, action: ResourceAction): Promise<{
        success: boolean;
        output?: string;
    }>;
    testConnection(_creds: CloudCredentials): Promise<boolean>;
}
