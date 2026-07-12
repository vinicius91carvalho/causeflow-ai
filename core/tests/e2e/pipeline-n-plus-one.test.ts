import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EHarness, assertEventSequence, waitForEvent } from './helpers/e2e-test-harness.js';
import type { E2EHarness } from './helpers/e2e-test-harness.js';
import { injectLatencySpike } from './scenarios/scenario-injector.js';
import { seedServiceGraph } from './scenarios/graph-seeder.js';
import { FixtureCodeRepository } from '../fixtures/fixture-code-repository.js';
import { nPlusOneQuery } from '../fixtures/scenarios/index.js';
import type { RawAlert } from '../../src/shared/application/ports/alert-source.port.js';
import type { Incident } from '../../src/modules/ingestion/domain/incident.entity.js';

describe('E2E Pipeline: N+1 Query with Code Analysis', () => {
  let harness: E2EHarness;
  let incident: Incident;

  const DATADOG_ALERT: RawAlert = {
    source: 'datadog',
    externalId: `n1-query-${Date.now()}`,
    payload: {
      alert_type: 'error',
      title: 'High latency on payment-service',
      body: 'Request latency exceeded 5000ms on /payments/with-orders endpoint. Database queries spiking to 50+ per request.',
      aggreg_key: 'payment-service',
      tags: ['env:production', 'service:payment-service'],
    },
  };

  beforeAll(async () => {
    const codeRepo = new FixtureCodeRepository(nPlusOneQuery);

    harness = await createE2EHarness({ codeRepo });

    // Configure change_detector to inspect code and find the N+1 issue
    harness.stubAgent.setAgentResponse('change_detector', {
      response:
        'Change detection: Commit nq01aaaa added findPaymentsWithOrders method that performs N+1 queries — individual SELECT for each payment in a loop instead of a JOIN.',
      toolCallsToMake: [
        {
          name: 'describe_service',
          input: { serviceName: 'payment-service', region: 'us-east-1' },
        },
        { name: 'get_recent_changes', input: { service: 'payment-service' } },
        { name: 'get_commit_diff', input: { service: 'payment-service', sha: 'nq01aaaa' } },
      ],
    });

    // Configure synthesis mentioning N+1 query
    harness.stubLLM.setScenario({
      synthesis: {
        potentialRootCause:
          'N+1 query in findPaymentsWithOrders — individual SELECT per payment instead of batch query or JOIN',
        recommendedActions: [
          {
            action: 'restart_service',
            params: { service: 'payment-service', cluster: 'production' },
          },
        ],
        findings: [
          {
            text: 'Commit nq01aaaa introduced N+1 query pattern in payment repository',
            evidenceIds: ['ev-1'],
          },
          {
            text: 'Each request to /payments/with-orders issues 1 + N database queries',
            evidenceIds: ['ev-2'],
          },
          { text: 'With 50 payments, this causes 51 queries per request', evidenceIds: ['ev-3'] },
        ],
      },
    });

    await injectLatencySpike({
      tenantId: harness.testTenant.tenantId,
      serviceName: 'payment-service',
      timestamp: new Date(),
    });

    await seedServiceGraph(undefined, harness.testTenant.tenantId);
  }, 60_000);

  afterAll(async () => {
    await harness.cleanup();
  });

  it('should ingest latency alert and create incident', async () => {
    incident = await harness.ctx.webhookUseCases.ingestAlert.execute(
      harness.testTenant.tenantId,
      DATADOG_ALERT,
    );

    expect(incident).toBeDefined();
    expect(incident.status).toBe('open');
  });

  it('should investigate with change_detector calling commit diff', async () => {
    await waitForEvent(harness.events, 'investigation.completed', 60_000);

    const runLog = harness.stubAgent.getRunLog();
    const changeDetectorRun = runLog.find((r) => r.role === 'change_detector');
    expect(changeDetectorRun).toBeDefined();

    // Verify change_detector called git tools
    const toolNames = changeDetectorRun!.toolCalls.map((t) => t.name);
    expect(toolNames).toContain('get_recent_changes');
    expect(toolNames).toContain('get_commit_diff');

    // Verify the diff contains the N+1 code
    const diffCall = changeDetectorRun!.toolCalls.find((t) => t.name === 'get_commit_diff');
    expect(diffCall).toBeDefined();
    const diffOutput = JSON.parse(diffCall!.output);
    expect(diffOutput.files[0].patch).toContain('N+1');
  });

  it('should synthesize root cause mentioning query issue', async () => {
    const updated = await harness.ctx.incidentUseCases.getIncident.execute(
      harness.testTenant.tenantId,
      incident.incidentId,
    );

    expect(updated.rootCause).toBeDefined();
    expect(updated.rootCause!.toLowerCase()).toContain('query');
  });

  it('should have correct event sequence', () => {
    assertEventSequence(harness.events, [
      'incident.created',
      'incident.status_changed',
      'investigation.completed',
      'remediation.proposed',
    ]);
  });
});
