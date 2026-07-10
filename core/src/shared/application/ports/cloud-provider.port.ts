export interface CloudCredentials {
    provider: string;
    credentials: Record<string, string>;
    region: string;
    expiresAt?: string;
}
export interface LogQuery {
    service: string;
    startTime: string;
    endTime: string;
    filter?: string;
    limit?: number;
}
export interface LogEntry {
    timestamp: string;
    message: string;
    level: string;
    service: string;
    metadata?: Record<string, unknown>;
}
export interface MetricQuery {
    metricName: string;
    namespace: string;
    startTime: string;
    endTime: string;
    period?: number;
    stat?: 'Average' | 'Sum' | 'Maximum' | 'Minimum' | 'p99' | 'p95';
}
export interface MetricDataPoint {
    timestamp: string;
    value: number;
    unit?: string;
}
export interface ServiceInfo {
    name: string;
    type: string;
    status: string;
    region: string;
    metadata?: Record<string, unknown>;
}
export interface ResourceAction {
    resourceId: string;
    action: string;
    params?: Record<string, unknown>;
}
export interface CloudProvider {
    readonly name: string;
    queryLogs(creds: CloudCredentials, query: LogQuery): Promise<LogEntry[]>;
    queryMetrics(creds: CloudCredentials, query: MetricQuery): Promise<MetricDataPoint[]>;
    describeService(creds: CloudCredentials, serviceName: string, region: string): Promise<ServiceInfo>;
    executeAction(creds: CloudCredentials, action: ResourceAction): Promise<{
        success: boolean;
        output?: string;
        beforeState?: Record<string, unknown>;
        afterState?: Record<string, unknown>;
    }>;
    testConnection(creds: CloudCredentials): Promise<boolean>;
}
