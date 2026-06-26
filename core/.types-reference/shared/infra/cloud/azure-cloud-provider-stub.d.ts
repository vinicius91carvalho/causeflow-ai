import type { CloudProvider, CloudCredentials, LogQuery, LogEntry, MetricQuery, MetricDataPoint, ServiceInfo, ResourceAction } from '../../application/ports/cloud-provider.port.js';
export declare class AzureCloudProviderStub implements CloudProvider {
    readonly name = "azure";
    queryLogs(_creds: CloudCredentials, _query: LogQuery): Promise<LogEntry[]>;
    queryMetrics(_creds: CloudCredentials, _query: MetricQuery): Promise<MetricDataPoint[]>;
    describeService(_creds: CloudCredentials, _serviceName: string, _region: string): Promise<ServiceInfo>;
    executeAction(_creds: CloudCredentials, _action: ResourceAction): Promise<{
        success: boolean;
        output?: string;
    }>;
    testConnection(_creds: CloudCredentials): Promise<boolean>;
}
