import type { RiskLevel } from './investigation.types.js';

export interface ActionDefinition {
    label: string;
    description: string;
    riskLevel: RiskLevel;
    estimatedDuration: string;
    requiresParams: string[];
}

/**
 * Flat catalog of all remediation actions the system can execute.
 * The LLM synthesis prompt receives this as context so it can select
 * and contextualise actions based on investigation evidence.
 */
export const ACTION_CATALOG: Record<string, ActionDefinition> = {
    restart_service: {
        label: 'Restart Service',
        description: 'Rolling restart of a service to clear transient state',
        riskLevel: 'low',
        estimatedDuration: '~2 min',
        requiresParams: ['service'],
    },
    increase_memory_limit: {
        label: 'Increase Memory Limit',
        description: 'Raise the memory allocation for a service or task',
        riskLevel: 'medium',
        estimatedDuration: '~5 min',
        requiresParams: ['service', 'newLimitMb'],
    },
    enable_heap_profiler: {
        label: 'Enable Heap Profiler',
        description: 'Attach a heap profiler to diagnose memory leaks',
        riskLevel: 'low',
        estimatedDuration: '~3 min',
        requiresParams: ['service'],
    },
    scale_horizontal: {
        label: 'Scale Horizontally',
        description: 'Increase the number of running instances of a service',
        riskLevel: 'medium',
        estimatedDuration: '~5 min',
        requiresParams: ['service', 'desiredCount'],
    },
    increase_pool_size: {
        label: 'Increase Connection Pool Size',
        description: 'Raise the database connection pool limit',
        riskLevel: 'medium',
        estimatedDuration: '~3 min',
        requiresParams: ['service', 'newPoolSize'],
    },
    enable_connection_timeout: {
        label: 'Enable Connection Timeout',
        description: 'Set idle timeout on database connections to prevent leaks',
        riskLevel: 'low',
        estimatedDuration: '~1 min',
        requiresParams: ['service', 'timeoutSeconds'],
    },
    scale_database: {
        label: 'Scale Database',
        description: 'Increase database instance size or add read replicas',
        riskLevel: 'high',
        estimatedDuration: '~15 min',
        requiresParams: ['dbIdentifier'],
    },
    rollback_deployment: {
        label: 'Rollback Deployment',
        description: 'Revert to the previous stable deployment version',
        riskLevel: 'medium',
        estimatedDuration: '~5 min',
        requiresParams: ['service'],
    },
    enable_circuit_breaker: {
        label: 'Enable Circuit Breaker',
        description: 'Activate circuit breaker on a failing dependency to prevent cascading failures',
        riskLevel: 'low',
        estimatedDuration: '~2 min',
        requiresParams: ['service', 'dependency'],
    },
    optimize_queries: {
        label: 'Optimize Queries',
        description: 'Apply query optimizations such as adding indexes or rewriting slow queries',
        riskLevel: 'medium',
        estimatedDuration: '~10 min',
        requiresParams: ['dbIdentifier'],
    },
    add_cache_layer: {
        label: 'Add Cache Layer',
        description: 'Introduce or extend caching to reduce backend load',
        riskLevel: 'medium',
        estimatedDuration: '~10 min',
        requiresParams: ['service'],
    },
    fix_race_condition: {
        label: 'Fix Race Condition',
        description: 'Apply locking or serialisation to eliminate a race condition',
        riskLevel: 'high',
        estimatedDuration: '~15 min',
        requiresParams: ['service'],
    },
    add_database_locking: {
        label: 'Add Database Locking',
        description: 'Introduce transaction-level locks to prevent data inconsistency',
        riskLevel: 'high',
        estimatedDuration: '~10 min',
        requiresParams: ['dbIdentifier'],
    },
    invalidate_cache: {
        label: 'Invalidate Cache',
        description: 'Clear stale cache entries that are serving incorrect data',
        riskLevel: 'low',
        estimatedDuration: '~1 min',
        requiresParams: ['cacheKey'],
    },
    escalate_to_oncall: {
        label: 'Escalate to On-Call',
        description: 'Page the on-call engineer for manual intervention',
        riskLevel: 'low',
        estimatedDuration: '~1 min',
        requiresParams: [],
    },
    send_customer_resolution: {
        label: 'Send Customer Resolution',
        description: 'Notify affected customers about the incident resolution',
        riskLevel: 'low',
        estimatedDuration: '~2 min',
        requiresParams: [],
    },
    create_fix_pr: {
        label: 'Create Fix PR',
        description: 'Open a pull request with a proposed code fix',
        riskLevel: 'medium',
        estimatedDuration: '~5 min',
        requiresParams: [],
    },
    check_sqs_dlq_depth: {
        label: 'Check SQS DLQ Depth',
        description: 'Inspect dead-letter queue depth for stuck or failed messages',
        riskLevel: 'low',
        estimatedDuration: '~1 min',
        requiresParams: ['queueUrl'],
    },
    purge_and_replay_dlq_messages: {
        label: 'Purge & Replay DLQ Messages',
        description: 'Move dead-letter messages back to the source queue for reprocessing',
        riskLevel: 'high',
        estimatedDuration: '~10 min',
        requiresParams: ['dlqUrl', 'sourceQueueUrl'],
    },
    increase_lambda_reserved_concurrency: {
        label: 'Increase Lambda Concurrency',
        description: 'Raise reserved concurrency for a Lambda function to handle higher throughput',
        riskLevel: 'medium',
        estimatedDuration: '~2 min',
        requiresParams: ['functionName', 'newConcurrency'],
    },
    enable_webhook_delivery_alerting_on_dlq_depth: {
        label: 'Enable Webhook DLQ Alerting',
        description: 'Set up CloudWatch alarms on DLQ depth to detect delivery failures early',
        riskLevel: 'low',
        estimatedDuration: '~3 min',
        requiresParams: ['queueUrl', 'threshold'],
    },
    audit_sqs_visibility_timeout_vs_lambda_timeout: {
        label: 'Audit SQS Visibility Timeout',
        description: 'Verify SQS visibility timeout is at least 6x Lambda timeout to prevent duplicate processing',
        riskLevel: 'low',
        estimatedDuration: '~2 min',
        requiresParams: ['queueUrl', 'functionName'],
    },
    implement_exponential_backoff_with_jitter_on_webhook_retries: {
        label: 'Add Exponential Backoff to Webhook Retries',
        description: 'Replace fixed-interval retries with exponential backoff + jitter to avoid thundering herd',
        riskLevel: 'medium',
        estimatedDuration: '~10 min',
        requiresParams: ['service'],
    },
    add_webhook_delivery_status_dashboard: {
        label: 'Create Webhook Delivery Dashboard',
        description: 'Build a CloudWatch or Grafana dashboard tracking webhook delivery success/failure rates',
        riskLevel: 'low',
        estimatedDuration: '~15 min',
        requiresParams: [],
    },
    check_endpoint_health: {
        label: 'Check Endpoint Health',
        description: 'Verify that a downstream endpoint is responding and healthy',
        riskLevel: 'low',
        estimatedDuration: '~1 min',
        requiresParams: ['endpoint'],
    },
};

/**
 * Builds a prompt fragment listing automatable actions for the synthesis LLM.
 * These are actions the system can execute automatically (automated=true).
 * The LLM is free to propose additional manual actions beyond this list.
 */
export function buildAvailableActionsPrompt(): string {
    const lines = Object.entries(ACTION_CATALOG).map(
        ([id, def]) =>
            `- ${id}: ${def.description} | risk: ${def.riskLevel} | ~${def.estimatedDuration} | params: ${def.requiresParams.length > 0 ? def.requiresParams.join(', ') : 'none'}`,
    );
    return `Actions the system can execute automatically (set automated=true when using these):\n${lines.join('\n')}`;
}
