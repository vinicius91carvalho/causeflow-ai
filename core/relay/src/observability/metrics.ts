import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export class MetricsRegistry {
  readonly registry = new Registry();

  readonly queries: Counter<string>;
  readonly queryErrors: Counter<string>;
  readonly policyDenials: Counter<string>;
  readonly masked: Counter<string>;
  readonly replayed: Counter<string>;
  readonly rateLimited: Counter<string>;
  readonly approvalsRequested: Counter<string>;
  readonly queryLatency: Histogram<string>;
  readonly connected: Gauge<string>;
  readonly resourceHealth: Gauge<string>;
  readonly auditBuffer: Gauge<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.queries = new Counter({
      name: 'causeflow_relay_queries_total',
      help: 'Total queries processed',
      labelNames: ['resource', 'operation', 'result'],
      registers: [this.registry],
    });
    this.queryErrors = new Counter({
      name: 'causeflow_relay_query_errors_total',
      help: 'Total query errors',
      labelNames: ['resource', 'operation', 'reason'],
      registers: [this.registry],
    });
    this.policyDenials = new Counter({
      name: 'causeflow_relay_policy_denials_total',
      help: 'Policy denials',
      labelNames: ['resource', 'reason'],
      registers: [this.registry],
    });
    this.masked = new Counter({
      name: 'causeflow_relay_masked_detections_total',
      help: 'Individual masking detections',
      labelNames: ['detector', 'resource'],
      registers: [this.registry],
    });
    this.replayed = new Counter({
      name: 'causeflow_relay_replayed_total',
      help: 'Replayed RPC requests dropped',
      registers: [this.registry],
    });
    this.rateLimited = new Counter({
      name: 'causeflow_relay_rate_limited_total',
      help: 'Requests dropped by rate limit',
      labelNames: ['resource'],
      registers: [this.registry],
    });
    this.approvalsRequested = new Counter({
      name: 'causeflow_relay_approvals_total',
      help: 'Queries that required human approval',
      labelNames: ['resource', 'reason'],
      registers: [this.registry],
    });
    this.queryLatency = new Histogram({
      name: 'causeflow_relay_query_latency_ms',
      help: 'Query latency distribution',
      labelNames: ['resource', 'operation'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
      registers: [this.registry],
    });
    this.connected = new Gauge({
      name: 'causeflow_relay_connected',
      help: '1 if the control plane is connected',
      registers: [this.registry],
    });
    this.resourceHealth = new Gauge({
      name: 'causeflow_relay_resource_healthy',
      help: '1 if resource is healthy',
      labelNames: ['resource', 'type'],
      registers: [this.registry],
    });
    this.auditBuffer = new Gauge({
      name: 'causeflow_relay_audit_buffer_size',
      help: 'Audit entries pending forward',
      registers: [this.registry],
    });
  }

  async contentType(): Promise<string> {
    return this.registry.contentType;
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
