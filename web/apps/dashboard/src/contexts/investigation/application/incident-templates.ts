/**
 * Incident templates for simulating AI-powered incident investigation results.
 * Each template covers a common incident category with realistic root causes,
 * recommendations, and timeline events.
 */

export interface IncidentTimelineEvent {
  timestamp?: string;
  event: string;
  detail: string;
}

export interface IncidentTemplate {
  category: string;
  keywords: string[];
  rootCause: string;
  resolution: string;
  baseConfidence: number;
  recommendations: string[];
  timelineEvents: IncidentTimelineEvent[];
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

export const INCIDENT_TEMPLATES: IncidentTemplate[] = [
  // 1. Database issues
  {
    category: 'database',
    keywords: [
      'throttling',
      'connection pool',
      'deadlock',
      'dynamodb',
      'rds',
      'query',
      'slow query',
      'database',
      'db',
      'postgres',
      'postgresql',
      'mysql',
      'mongodb',
      'connection',
      'timeout db',
    ],
    rootCause:
      'The incident was caused by a combination of connection pool exhaustion and elevated query latency. Specifically, a missing index on the `user_events` table caused full table scans that grew exponentially with dataset size. Under load, connection wait times exceeded the configured 30-second timeout, cascading into HTTP 503 responses. Secondary contributor: a background job running hourly analytics aggregations competed for connection slots during peak traffic.',
    resolution:
      'Added a composite index on `user_events(tenant_id, created_at DESC)` to eliminate full table scans. Increased the connection pool from 10 to 25 connections. Moved the analytics aggregation job to off-peak hours (02:00–04:00 UTC).',
    baseConfidence: 87,
    recommendations: [
      'Add a composite index on `user_events (tenant_id, created_at DESC)` to eliminate full table scans.',
      'Increase the connection pool size from 10 to 25 connections and implement connection wait-timeout of 5 seconds with exponential backoff.',
      'Move the analytics aggregation job to off-peak hours (02:00–04:00 UTC) and add a semaphore to limit concurrent DB connections.',
      'Enable query-level timeout enforcement at the ORM layer (max 10s) to fail fast rather than hold connections.',
      'Set up CloudWatch / Datadog alerts for connection pool utilization > 80% with 2-minute evaluation window.',
    ],
    timelineEvents: [
      {
        event: 'Anomaly detected',
        detail: 'P95 database query latency crossed 2 000 ms threshold',
      },
      {
        event: 'First 503 errors',
        detail: 'API gateway began returning 503 on /api/v1/events endpoint',
      },
      {
        event: 'Connection pool exhausted',
        detail: 'All 10 connection slots in use; new requests queued',
      },
      {
        event: 'Alert triggered',
        detail: 'PagerDuty alert fired: error rate > 5% for 5 consecutive minutes',
      },
      {
        event: 'On-call engineer engaged',
        detail: 'SRE acknowledged incident via PagerDuty mobile app',
      },
      {
        event: 'Root cause identified',
        detail: 'Query plan analysis revealed full table scan on user_events',
      },
      {
        event: 'Mitigation applied',
        detail: 'Temporary: connection pool limit doubled via env variable restart',
      },
      {
        event: 'Incident resolved',
        detail: 'Error rate returned to < 0.1%; monitoring for stability',
      },
    ],
  },

  // 2. Service / Lambda / API errors
  {
    category: 'service',
    keywords: [
      '500',
      'timeout',
      'cold start',
      'lambda',
      'api gateway',
      'service',
      'error rate',
      '503',
      'latency',
      'response time',
      'crash',
      'restart',
      'oom',
      'out of memory',
      'memory',
    ],
    rootCause:
      "A Lambda function handling webhook ingestion encountered cold start latency spikes (up to 8 seconds) after a dependency update that increased the deployment package from 12 MB to 47 MB. The API Gateway integration timeout of 5 seconds caused it to return 504 errors before the Lambda completed initialization. This was compounded by a burst of concurrent invocations following a customer batch import that exhausted the account's Lambda concurrency limit (1 000) in the us-east-1 region.",
    resolution:
      'Rolled back to the previous Lambda version via CodeDeploy. Configured Provisioned Concurrency (10 instances) on the webhook function. Increased API Gateway integration timeout to 29 seconds.',
    baseConfidence: 82,
    recommendations: [
      'Reduce Lambda package size by switching to ESM tree-shaking and moving heavy dependencies to Lambda Layers.',
      'Enable Lambda Provisioned Concurrency (minimum 10 instances) for the webhook ingestion function during business hours.',
      'Increase API Gateway integration timeout from 5 seconds to 29 seconds (Lambda max) and add client-side retry with jitter.',
      'Request a Lambda concurrency limit increase from AWS Support (1 000 → 3 000) and set per-function reserved concurrency.',
      'Instrument cold start duration via AWS X-Ray and set an alarm when p99 initialization time exceeds 3 seconds.',
    ],
    timelineEvents: [
      {
        event: 'Deployment completed',
        detail: 'v2.14.0 deployed to production — package size grew from 12 MB to 47 MB',
      },
      {
        event: 'Cold start spike',
        detail: 'Lambda initialization time jumped to 6–8 s (baseline: 800 ms)',
      },
      {
        event: 'API 504 errors begin',
        detail: 'API Gateway started returning 504 timeouts on webhook endpoint',
      },
      {
        event: 'Customer batch import',
        detail: 'Large customer triggered 2 400 concurrent Lambda invocations',
      },
      {
        event: 'Concurrency limit reached',
        detail: 'Lambda throttling activated; invocations started failing with 429',
      },
      {
        event: 'Alert triggered',
        detail: 'Datadog alert: webhook success rate < 90% for 3 minutes',
      },
      { event: 'Rollback initiated', detail: 'SRE rolled back to v2.13.0 via CodeDeploy' },
      {
        event: 'Service stabilized',
        detail: 'Cold start times returned to baseline; 504 errors ceased',
      },
    ],
  },

  // 3. Infrastructure / scaling / capacity
  {
    category: 'infrastructure',
    keywords: [
      'cpu',
      'memory',
      'disk',
      'network',
      'scaling',
      'capacity',
      'ec2',
      'ecs',
      'kubernetes',
      'k8s',
      'pod',
      'node',
      'load balancer',
      'autoscaling',
      'resource',
      'utilization',
      'high cpu',
      'high memory',
    ],
    rootCause:
      'CPU saturation on the ECS task cluster was triggered by a combination of: (1) an autoscaling policy with a 10-minute cooldown that failed to react quickly enough to a sudden 4× traffic spike, and (2) a memory leak in the session management middleware introduced in v3.8.2 that caused tasks to consume 2× their expected memory after 6 hours of runtime. When ECS attempted to add new tasks, memory pressure on existing nodes prevented scheduling, creating a deadlock where new tasks could not start.',
    resolution:
      'Reduced autoscaling cooldown to 2 minutes with step-scaling for >80% CPU. Fixed session middleware memory leak (EventEmitter listeners). Increased ECS task memory limits. Manual capacity increase resolved the immediate deadlock.',
    baseConfidence: 79,
    recommendations: [
      'Reduce autoscaling cooldown period from 10 minutes to 2 minutes and add a scale-up step policy for 80%+ CPU utilization.',
      'Fix the session middleware memory leak — audit use of `EventEmitter` listeners that are not properly removed on request completion.',
      'Set ECS task memory limits 20% lower than instance capacity to ensure the scheduler can always place new tasks.',
      'Implement pod disruption budgets (or ECS deployment circuit breakers) to prevent full replacement during high-load events.',
      'Add scheduled scaling: pre-provision +30% capacity 15 minutes before known peak traffic windows.',
    ],
    timelineEvents: [
      {
        event: 'Traffic spike detected',
        detail: 'ALB request rate increased 4× over 90-second window',
      },
      {
        event: 'CPU saturation',
        detail: 'ECS tasks CPU utilization reached 95%; p99 latency > 5 s',
      },
      {
        event: 'Autoscaling triggered',
        detail: 'Scale-out policy fired; new task provisioning began',
      },
      {
        event: 'Memory pressure',
        detail: 'Existing tasks at 190% of configured soft memory limit',
      },
      {
        event: 'Scheduling failure',
        detail: 'ECS unable to place new tasks — insufficient memory on hosts',
      },
      {
        event: 'Health check failures',
        detail: 'ALB started marking tasks unhealthy; traffic rerouted',
      },
      {
        event: 'Incident escalated',
        detail: 'Automated runbook triggered task force-stop and restart cycle',
      },
      {
        event: 'Cluster stabilized',
        detail: 'Manual capacity increase resolved scheduling deadlock',
      },
    ],
  },

  // 4. Deployment / config change / rollback
  {
    category: 'deployment',
    keywords: [
      'deploy',
      'deployment',
      'release',
      'rollback',
      'config',
      'configuration',
      'change',
      'version',
      'migration',
      'env',
      'environment variable',
      'feature flag',
      'canary',
      'blue green',
    ],
    rootCause:
      'A configuration change deployment pushed an incorrect `DATABASE_POOL_MAX` environment variable value of `"0"` (string) instead of `0` (integer), causing the ORM connection pool to interpret the value as a falsy non-zero string and use the default pool size of 1 connection. This single-connection mode serialized all database operations, causing a 40× increase in response times. The change was part of a broader secrets rotation and was not caught by pre-deployment validation because the environment schema lacked type-coercion checks.',
    resolution:
      'Rolled back to the previous ECS task definition revision. Added Zod schema validation for all environment variables at application startup. Implemented a pre-deployment config diff review checklist.',
    baseConfidence: 93,
    recommendations: [
      'Add Zod/Joi schema validation for all environment variables at application startup, with strict type coercion.',
      'Implement a pre-deployment checklist that requires config diff review for any environment variable changes.',
      'Add integration tests that boot the application against staging with the exact production config values.',
      'Use a secrets manager (AWS Secrets Manager / Vault) with typed schema to prevent string/integer mismatches.',
      'Enable canary deployments with automatic rollback triggered when error rate exceeds 1% within 5 minutes of deployment.',
    ],
    timelineEvents: [
      {
        event: 'Secrets rotation initiated',
        detail: 'Automated secrets rotation job updated 14 environment variables',
      },
      {
        event: 'Deployment triggered',
        detail: 'ECS service update triggered for all tasks in production cluster',
      },
      {
        event: 'Error rate spike',
        detail: 'HTTP 500 error rate jumped from 0.02% to 38% within 90 seconds of deployment',
      },
      {
        event: 'Database timeout flood',
        detail: 'All API responses timing out; single connection serializing all queries',
      },
      { event: 'On-call paged', detail: 'PagerDuty P1 alert: error rate threshold breached' },
      {
        event: 'Config diff reviewed',
        detail: 'Engineer identified DATABASE_POOL_MAX type mismatch in ECS task definition',
      },
      { event: 'Rollback deployed', detail: 'Previous ECS task definition revision re-deployed' },
      { event: 'Full recovery', detail: 'Error rate returned to baseline; post-mortem scheduled' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Default / fallback template
// ---------------------------------------------------------------------------

export const DEFAULT_TEMPLATE: IncidentTemplate = {
  category: 'general',
  keywords: [],
  rootCause:
    'The investigation identified a multi-factor cascade failure originating from elevated request latency in a downstream service. The initial latency increase caused request queues to back up, exhausting thread pool resources in the upstream service. Once thread pool saturation occurred, connection resets propagated across the service mesh, resulting in widespread user-facing errors. Contributing factors include insufficient circuit breaker configuration and lack of bulkhead isolation between service consumers.',
  resolution:
    'Circuit breakers were configured between service boundaries. Bulkhead isolation added using separate thread pools for each downstream dependency. Timeout configuration updated across all service-to-service calls.',
  baseConfidence: 71,
  recommendations: [
    'Implement circuit breakers between service boundaries with a half-open state timeout of 30 seconds.',
    'Add bulkhead isolation using separate thread pools for each downstream dependency.',
    'Review and update timeout configuration across all service-to-service calls to prevent cascade failures.',
    'Add distributed tracing (e.g., AWS X-Ray or OpenTelemetry) to quickly identify latency hotspots in future incidents.',
    'Conduct a chaos engineering exercise to validate resilience patterns under realistic failure conditions.',
  ],
  timelineEvents: [
    {
      event: 'Latency anomaly detected',
      detail: 'Downstream service p95 latency exceeded 3× baseline',
    },
    { event: 'Request queue buildup', detail: 'Upstream service request queues began growing' },
    {
      event: 'Thread pool saturation',
      detail: 'Worker thread pool exhausted; new requests rejected',
    },
    { event: 'Error rate escalation', detail: 'User-facing error rate crossed 10% threshold' },
    { event: 'Alert fired', detail: 'On-call engineer paged via PagerDuty' },
    {
      event: 'Mitigation applied',
      detail: 'Traffic shedding enabled; non-critical endpoints disabled',
    },
    { event: 'Recovery begins', detail: 'Error rate declining as queue backlog clears' },
    { event: 'Incident resolved', detail: 'All metrics returned to normal operating range' },
  ],
};

// ---------------------------------------------------------------------------
// Template selector
// ---------------------------------------------------------------------------

/**
 * Select the best matching template for a given incident description.
 * Keyword matching is case-insensitive, scored by number of matches.
 * Falls back to the DEFAULT_TEMPLATE if no template matches.
 */
export function selectTemplate(description: string): IncidentTemplate {
  const lower = description.toLowerCase();

  let bestTemplate: IncidentTemplate | null = null;
  let bestScore = 0;

  for (const template of INCIDENT_TEMPLATES) {
    const score = template.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }

  return bestTemplate ?? DEFAULT_TEMPLATE;
}

/**
 * Generate a sequence of timeline event timestamps relative to a start time.
 * Spaces events roughly 1–3 minutes apart.
 */
export function generateTimestamps(startIso: string, count: number, intervalMs = 90_000): string[] {
  const start = new Date(startIso).getTime();
  const timestamps: string[] = [];
  let current = start;

  for (let i = 0; i < count; i++) {
    // Add jitter: ±30% of interval
    const jitter = intervalMs * (0.7 + Math.random() * 0.6);
    current += i === 0 ? 0 : Math.round(jitter);
    timestamps.push(new Date(current).toISOString());
  }

  return timestamps;
}
