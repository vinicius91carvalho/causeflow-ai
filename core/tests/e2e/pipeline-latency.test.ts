import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createE2EHarness,
  findEvent,
  waitForEvent,
  assertEventSequence,
} from './helpers/e2e-test-harness.js';
import type { E2EHarness } from './helpers/e2e-test-harness.js';
import { injectLatencySpike } from './scenarios/scenario-injector.js';
import type { RawAlert } from '../../src/shared/application/ports/alert-source.port.js';
import type { Incident } from '../../src/modules/ingestion/domain/incident.entity.js';

describe('E2E Pipeline: Latency Spike Scenario', () => {
  let harness: E2EHarness;
  let incident: Incident;

  const DATADOG_ALERT: RawAlert = {
    source: 'datadog',
    externalId: `latency-alert-${Date.now()}`,
    payload: {
      alert_type: 'error',
      title: 'High latency on api-gateway',
      body: 'Request latency exceeded 1200ms threshold on api-gateway. Database connection timeouts detected. Circuit breaker triggered.',
      aggreg_key: 'api-gateway',
      tags: ['env:production', 'service:api-gateway', 'team:platform'],
    },
  };

  beforeAll(async () => {
    harness = await createE2EHarness();

    // Configure stubs for latency scenario
    harness.stubLLM.setScenario({
      triage: {
        priority: 'critical',
        suggestedAgents: ['log_analyst', 'metric_analyst', 'infra_inspector'],
        summary: 'High latency with database connection timeouts',
        confidence: 0.95,
        category: 'database',
        investigationMode: 'orchestrator',
      },
      synthesis: {
        potentialRootCause:
          'Database connection timeout — connection pool exhausted due to slow queries',
        recommendedActions: [
          { action: 'restart_service', params: { service: 'api-gateway', cluster: 'production' } },
          {
            action: 'scale_service',
            params: { service: 'api-gateway', cluster: 'production', desiredCount: 5 },
          },
        ],
        findings: [
          { text: 'Request latency spiked from 120ms to 1200ms', evidenceIds: ['ev-1'] },
          { text: 'Database connection timeout errors in logs', evidenceIds: ['ev-2'] },
          { text: 'Circuit breaker triggered after 3 failed retries', evidenceIds: ['ev-3'] },
        ],
      },
    });

    // Configure agent stubs for latency investigation
    harness.stubAgent.setAgentResponse('log_analyst', {
      response:
        'Log analysis: Found database connection timeout errors. Circuit breaker opened. 47 requests returned 503.',
      toolCallsToMake: [
        {
          name: 'query_logs',
          input: {
            service: 'api-gateway',
            filter: 'timeout',
            startTime: new Date(Date.now() - 3600000).toISOString(),
            endTime: new Date().toISOString(),
            limit: 20,
          },
        },
      ],
    });

    harness.stubAgent.setAgentResponse('metric_analyst', {
      response:
        'Metric analysis: RequestLatency spiked from baseline 120ms to 1200ms+. Sustained high for 10+ minutes.',
      toolCallsToMake: [
        {
          name: 'query_metrics',
          input: {
            metricName: 'RequestLatency',
            namespace: 'Custom/App',
            startTime: new Date(Date.now() - 3600000).toISOString(),
            endTime: new Date().toISOString(),
            period: 60,
            stat: 'Average',
          },
        },
      ],
    });

    harness.stubAgent.setAgentResponse('infra_inspector', {
      response:
        'Infrastructure: api-gateway running in cluster production with 3 tasks. Service is ACTIVE.',
      toolCallsToMake: [
        {
          name: 'describe_service',
          input: { serviceName: 'api-gateway', region: 'us-east-1' },
        },
      ],
    });

    // Inject latency spike data into Customer LocalStack
    await injectLatencySpike({
      tenantId: harness.testTenant.tenantId,
      serviceName: 'api-gateway',
      timestamp: new Date(),
    });
  }, 60_000);

  afterAll(async () => {
    await harness.cleanup();
  });

  it('should ingest Datadog alert and create incident', async () => {
    incident = await harness.ctx.webhookUseCases.ingestAlert.execute(
      harness.testTenant.tenantId,
      DATADOG_ALERT,
    );

    expect(incident).toBeDefined();
    expect(incident.status).toBe('open');
    expect(incident.sourceProvider).toBe('datadog');
    expect(incident.severity).toBe('critical');
  });

  it('should complete investigation with agents calling query_metrics and describe_service', async () => {
    await waitForEvent(harness.events, 'investigation.completed', 60_000);

    const runLog = harness.stubAgent.getRunLog();
    const toolNames = runLog.flatMap((entry) => entry.toolCalls.map((tc) => tc.name));

    const hasLogTool = toolNames.some(
      (n) => n === 'query_logs' || n === 'aws_api_call' || n === 'get_incident_details',
    );
    const hasMetricTool = toolNames.some((n) => n === 'query_metrics' || n === 'aws_api_call');
    const hasInfraTool = toolNames.some((n) => n === 'describe_service' || n === 'aws_api_call');

    expect(hasLogTool).toBe(true);
    expect(hasMetricTool).toBe(true);
    expect(hasInfraTool).toBe(true);
  });

  it('should have database timeout as root cause', async () => {
    const updated = await harness.ctx.incidentUseCases.getIncident.execute(
      harness.testTenant.tenantId,
      incident.incidentId,
    );
    expect(updated.rootCause).toBeDefined();
    expect(updated.rootCause!.toLowerCase()).toContain('connection');
  });

  it('should propose remediation with scale action', async () => {
    await waitForEvent(harness.events, 'remediation.proposed', 15_000);

    const remEvent = findEvent(harness.events, 'remediation.proposed');
    expect(remEvent).toBeDefined();
  });

  it('should have correct event sequence for latency scenario', () => {
    assertEventSequence(harness.events, [
      'incident.created',
      'incident.status_changed',
      'investigation.completed',
      'remediation.proposed',
    ]);
  });
});
