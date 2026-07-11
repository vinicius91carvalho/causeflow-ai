import type { CloudProvider, CloudCredentials, LogQuery, LogEntry, MetricQuery, MetricDataPoint, ServiceInfo, ResourceAction } from '../../application/ports/cloud-provider.port.js';

const resourceStates = new Map<string, Record<string, unknown>>();

const DEFAULT_STATE: Record<string, unknown> = {
    desiredCount: 3,
    replicas: 1,
    status: 'running',
};

/**
 * Actions the stub executes successfully with a before/after state diff.
 * Anything else fails deterministically (AC-047: success or failure by action type).
 */
const SUCCESS_ACTIONS = new Set([
    'restart',
    'restart_service',
    'scale_horizontal',
    'scale_service',
    'scale_database',
    'increase_memory_limit',
    'increase_pool_size',
    'enable_heap_profiler',
    'enable_connection_timeout',
    'enable_circuit_breaker',
    'rollback_deployment',
    'rollback_service',
    'run_command',
    'optimize_queries',
    'add_cache_layer',
    'invalidate_cache',
    'escalate_to_oncall',
    'send_customer_resolution',
    'check_sqs_dlq_depth',
    'increase_lambda_reserved_concurrency',
    'enable_webhook_delivery_alerting_on_dlq_depth',
    'audit_sqs_visibility_timeout_vs_lambda_timeout',
]);

function resourceKey(resourceId: string, params?: Record<string, unknown>): string {
    const service = (params?.service as string | undefined) ?? 'default';
    return `${resourceId}:${service}`;
}

function applyParamsToState(current: Record<string, unknown>, params?: Record<string, unknown>): Record<string, unknown> {
    const next = { ...current };
    for (const [key, value] of Object.entries(params ?? {})) {
        if (key === 'service' || key === 'proposedFix') {
            continue;
        }
        next[key] = value;
    }
    // Common remediation aliases → canonical state fields
    if (typeof params?.desiredCount === 'number') {
        next['desiredCount'] = params.desiredCount;
        next['replicas'] = params.desiredCount;
    }
    if (actionImpliesRestart(params)) {
        next['status'] = 'running';
        next['restartedAt'] = new Date().toISOString();
    }
    return next;
}

function actionImpliesRestart(params?: Record<string, unknown>): boolean {
    return params !== undefined && Object.keys(params).length === 1 && 'service' in params;
}

export class StubCloudProvider implements CloudProvider {
    name = 'stub';
    async queryLogs(_creds: CloudCredentials, query: LogQuery): Promise<LogEntry[]> {
        const now = new Date();
        const service = query.service;
        const filter = query.filter?.toLowerCase() ?? '';
        const scenarios = {
            cpu: [
                { timestamp: ts(now, -10), message: `[${service}] CPU usage spike detected: 95.2%`, level: 'error', service },
                { timestamp: ts(now, -9), message: `[${service}] Thread pool exhausted, request queue growing`, level: 'error', service },
                { timestamp: ts(now, -8), message: `[${service}] GC pause: 1200ms (threshold: 200ms)`, level: 'warn', service },
                { timestamp: ts(now, -7), message: `[${service}] Scaling event triggered: desired=4 running=2`, level: 'info', service },
                { timestamp: ts(now, -5), message: `[${service}] Health check failed: timeout after 30s`, level: 'error', service },
            ],
            oom: [
                { timestamp: ts(now, -12), message: `[${service}] Memory usage: 89% (4.2GB / 4.7GB)`, level: 'warn', service },
                { timestamp: ts(now, -10), message: `[${service}] Memory usage: 95% (4.5GB / 4.7GB)`, level: 'error', service },
                { timestamp: ts(now, -8), message: `[${service}] OOMKilled: container exceeded memory limit`, level: 'error', service },
                { timestamp: ts(now, -7), message: `[${service}] Container restarting (exit code 137)`, level: 'error', service },
                { timestamp: ts(now, -5), message: `[${service}] Service recovered after restart`, level: 'info', service },
            ],
            timeout: [
                { timestamp: ts(now, -15), message: `[${service}] Connection to database timed out after 5000ms`, level: 'error', service },
                { timestamp: ts(now, -14), message: `[${service}] Retry attempt 1/3 for db connection`, level: 'warn', service },
                { timestamp: ts(now, -13), message: `[${service}] Retry attempt 2/3 for db connection`, level: 'warn', service },
                { timestamp: ts(now, -12), message: `[${service}] Circuit breaker opened for database pool`, level: 'error', service },
                { timestamp: ts(now, -10), message: `[${service}] 503 Service Unavailable returned for 23 requests`, level: 'error', service },
                { timestamp: ts(now, -5), message: `[${service}] Circuit breaker half-open, testing connection`, level: 'info', service },
            ],
        };
        if (filter.includes('deploy') || filter.includes('change') || filter.includes('config')) {
            return [
                { timestamp: ts(now, -120), message: `[${service}] Deployment started: v2.3.1 → v2.4.0`, level: 'info', service },
                { timestamp: ts(now, -118), message: `[${service}] Config change: WORKER_POOL_SIZE 10 → 5`, level: 'info', service },
                { timestamp: ts(now, -115), message: `[${service}] Deployment completed: v2.4.0 (3 tasks rolled)`, level: 'info', service },
                { timestamp: ts(now, -60), message: `[${service}] Feature flag toggled: new-cache-layer=true`, level: 'info', service },
                { timestamp: ts(now, -10), message: `[${service}] Auto-scaling event: desired count 2 → 3`, level: 'warn', service },
            ];
        }
        if (filter.includes('oom') || filter.includes('memory'))
            return scenarios['oom'];
        if (filter.includes('timeout') || filter.includes('connection'))
            return scenarios['timeout'];
        return scenarios['cpu'];
    }
    async queryMetrics(_creds: CloudCredentials, query: MetricQuery): Promise<MetricDataPoint[]> {
        const now = new Date();
        const points = [];
        const metric = query.metricName.toLowerCase();
        const baseValue = metric.includes('cpu') ? 35 : metric.includes('memory') ? 60 : metric.includes('latency') ? 120 : 50;
        const unit = metric.includes('cpu') ? 'Percent' : metric.includes('memory') ? 'Percent' : metric.includes('latency') ? 'Milliseconds' : 'Count';
        // Deterministic 30-point series with a fixed anomaly spike (no Math.random).
        for (let i = 30; i >= 0; i--) {
            const jitter = ((i * 7) % 11) - 5;
            const isAnomalyWindow = i >= 8 && i <= 15;
            const spikeMultiplier = isAnomalyWindow ? 2.5 : 1;
            points.push({
                timestamp: ts(now, -i),
                value: Math.round((baseValue * spikeMultiplier + jitter) * 10) / 10,
                unit,
            });
        }
        return points;
    }
    async describeService(_creds: CloudCredentials, serviceName: string, region: string): Promise<ServiceInfo> {
        return {
            name: serviceName,
            type: 'ECS',
            status: 'ACTIVE',
            region,
            metadata: {
                taskDefinition: `${serviceName}:42`,
                desiredCount: 3,
                runningCount: 2,
                pendingCount: 1,
                cpu: '1024',
                memory: '2048',
                launchType: 'FARGATE',
                networkMode: 'awsvpc',
                loadBalancer: `alb-${serviceName}-prod`,
                lastDeployment: new Date(Date.now() - 86400000 * 3).toISOString(),
                healthCheckPath: '/health',
                healthCheckStatus: 'unhealthy',
            },
        };
    }
    async executeAction(_creds: CloudCredentials, action: ResourceAction): Promise<{
        success: boolean;
        output?: string;
        beforeState?: Record<string, unknown>;
        afterState?: Record<string, unknown>;
    }> {
        await sleep(50);
        const key = resourceKey(action.resourceId, action.params);
        const current = resourceStates.get(key) ?? { ...DEFAULT_STATE };
        const beforeState = { ...current };

        if (!SUCCESS_ACTIONS.has(action.action)) {
            return {
                success: false,
                output: `StubCloudProvider: unsupported action '${action.action}'`,
                beforeState,
                afterState: beforeState,
            };
        }

        const afterState = applyParamsToState(current, action.params);
        // Action-specific deterministic state transitions
        if (action.action === 'restart' || action.action === 'restart_service') {
            afterState['status'] = 'running';
            afterState['restartedAt'] = 'stub-restart';
        }
        resourceStates.set(key, afterState);
        return {
            success: true,
            output: `Action '${action.action}' executed on '${action.resourceId}' successfully`,
            beforeState,
            afterState,
        };
    }
    async testConnection(_creds: CloudCredentials): Promise<boolean> {
        return true;
    }
}
function ts(base: Date, minutesOffset: number) {
    return new Date(base.getTime() + minutesOffset * 60000).toISOString();
}
function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
