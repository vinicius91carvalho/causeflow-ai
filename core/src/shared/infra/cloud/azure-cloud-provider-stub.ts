import { AppError } from '../../domain/errors.js';
import type { CloudProvider, CloudCredentials, LogQuery, LogEntry, MetricQuery, MetricDataPoint, ServiceInfo, ResourceAction } from '../../application/ports/cloud-provider.port.js';
export class AzureCloudProviderStub {
    name = 'azure';
    async queryLogs(_creds: CloudCredentials, _query: LogQuery): Promise<LogEntry[]> {
        throw new AppError('Azure support coming soon', 'NOT_IMPLEMENTED', 501);
    }
    async queryMetrics(_creds: CloudCredentials, _query: MetricQuery): Promise<MetricDataPoint[]> {
        throw new AppError('Azure support coming soon', 'NOT_IMPLEMENTED', 501);
    }
    async describeService(_creds: CloudCredentials, _serviceName: string, _region: string): Promise<ServiceInfo> {
        throw new AppError('Azure support coming soon', 'NOT_IMPLEMENTED', 501);
    }
    async executeAction(_creds: CloudCredentials, _action: ResourceAction): Promise<{ success: boolean; output?: string }> {
        throw new AppError('Azure support coming soon', 'NOT_IMPLEMENTED', 501);
    }
    async testConnection(_creds: CloudCredentials): Promise<boolean> {
        return false;
    }
}
