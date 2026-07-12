import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createE2EHarness,
  findEvent,
  assertEventSequence,
  waitForEvent,
} from './helpers/e2e-test-harness.js';
import type { E2EHarness } from './helpers/e2e-test-harness.js';
import { injectOOMScenario } from './scenarios/scenario-injector.js';
import { seedServiceGraph } from './scenarios/graph-seeder.js';
import { FixtureCodeRepository } from '../fixtures/fixture-code-repository.js';
import { oomMemoryLeak } from '../fixtures/scenarios/index.js';
import type { RawAlert } from '../../src/shared/application/ports/alert-source.port.js';
import type { Incident } from '../../src/modules/ingestion/domain/incident.entity.js';

describe('E2E Pipeline: Memory Leak with Code Analysis', () => {
  let harness: E2EHarness;
  let incident: Incident;

  const CLOUDWATCH_ALERT: RawAlert = {
    source: 'cloudwatch',
    externalId: `memleak-code-${Date.now()}`,
    payload: {
      AlarmName: 'payment-service-memory-critical',
      NewStateValue: 'ALARM',
      NewStateReason:
        'Threshold Crossed: 1 out of 1 datapoints [95.2 (17/02/2026 10:00:00)] was greater than the threshold (90.0).',
      Trigger: { Namespace: 'AWS/ECS' },
      Region: 'us-east-1',
      AlarmArn: 'arn:aws:cloudwatch:us-east-1:000000000000:alarm:payment-service-memory-critical',
    },
  };

  beforeAll(async () => {
    const codeRepo = new FixtureCodeRepository(oomMemoryLeak);

    harness = await createE2EHarness({ codeRepo });

    // Configure change_detector stub to return code-aware analysis
    harness.stubAgent.setAgentResponse('change_detector', {
      response:
        'Change detection: Recent commit e5f6g7h8 added unbounded in-memory cache (paymentCache Map) in payment.service.ts. This Map grows without eviction, causing memory leak and eventual OOM kill.',
      toolCallsToMake: [
        {
          name: 'describe_service',
          input: { serviceName: 'payment-service', region: 'us-east-1' },
        },
        { name: 'get_recent_changes', input: { service: 'payment-service' } },
        {
          name: 'get_deployments',
          input: { service: 'payment-service', environment: 'production' },
        },
      ],
    });

    // Configure synthesis to mention memory leak + cache
    harness.stubLLM.setScenario({
      synthesis: {
        potentialRootCause:
          'OOM memory leak caused by unbounded paymentCache Map in payment.service.ts — grows without eviction',
        recommendedActions: [
          {
            action: 'restart_service',
            params: { service: 'payment-service', cluster: 'production' },
          },
          {
            action: 'scale_service',
            params: { service: 'payment-service', cluster: 'production', desiredCount: 3 },
          },
        ],
        findings: [
          { text: 'Memory utilization reached 95% before OOM kill', evidenceIds: ['ev-1'] },
          { text: 'Commit e5f6g7h8 introduced unbounded paymentCache Map', evidenceIds: ['ev-2'] },
          {
            text: 'Cache grows with every payment read — no TTL or max size',
            evidenceIds: ['ev-3'],
          },
        ],
      },
    });

    await injectOOMScenario({
      tenantId: harness.testTenant.tenantId,
      serviceName: 'payment-service',
      timestamp: new Date(),
    });

    await seedServiceGraph(undefined, harness.testTenant.tenantId);
  }, 60_000);

  afterAll(async () => {
    await harness.cleanup();
  });

  it('should ingest alert and create incident', async () => {
    incident = await harness.ctx.webhookUseCases.ingestAlert.execute(
      harness.testTenant.tenantId,
      CLOUDWATCH_ALERT,
    );

    expect(incident).toBeDefined();
    expect(incident.status).toBe('open');
    expect(incident.severity).toBe('critical');
  });

  it('should investigate with change_detector calling code tools', async () => {
    await waitForEvent(harness.events, 'investigation.completed', 60_000);

    const runLog = harness.stubAgent.getRunLog();
    const changeDetectorRun = runLog.find((r) => r.role === 'change_detector');
    expect(changeDetectorRun).toBeDefined();

    // Verify change_detector called GitHub tools
    const toolNames = changeDetectorRun!.toolCalls.map((t) => t.name);
    expect(toolNames).toContain('get_recent_changes');
    expect(toolNames).toContain('get_deployments');

    // Verify the tool returned actual fixture data
    const commitsCall = changeDetectorRun!.toolCalls.find((t) => t.name === 'get_recent_changes');
    expect(commitsCall).toBeDefined();
    const commitsOutput = JSON.parse(commitsCall!.output) as Array<{ message: string }>;
    expect(commitsOutput.length).toBeGreaterThan(0);
    expect(commitsOutput.some((c) => c.message.includes('caching'))).toBe(true);
  });

  it('should synthesize root cause mentioning memory leak and cache', async () => {
    const updated = await harness.ctx.incidentUseCases.getIncident.execute(
      harness.testTenant.tenantId,
      incident.incidentId,
    );

    expect(updated.rootCause).toBeDefined();
    expect(updated.rootCause!.toLowerCase()).toContain('memory');
    expect(updated.rootCause!.toLowerCase()).toMatch(/leak|cache/);
  });

  it('should propose remediation automatically', async () => {
    await waitForEvent(harness.events, 'remediation.proposed', 15_000);

    const remEvent = findEvent(harness.events, 'remediation.proposed');
    expect(remEvent).toBeDefined();
    expect(remEvent!.payload['incidentId']).toBe(incident.incidentId);
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
