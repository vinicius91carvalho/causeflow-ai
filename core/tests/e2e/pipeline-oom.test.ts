import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EHarness, findEvent, findEvents, assertEventSequence, waitForEvent } from './helpers/e2e-test-harness.js';
import type { E2EHarness } from './helpers/e2e-test-harness.js';
import { injectOOMScenario } from './scenarios/scenario-injector.js';
import { seedServiceGraph } from './scenarios/graph-seeder.js';
import type { RawAlert } from '../../src/shared/application/ports/alert-source.port.js';
import type { Incident } from '../../src/modules/ingestion/domain/incident.entity.js';

describe('E2E Pipeline: OOM Kill Scenario', () => {
  let harness: E2EHarness;
  let incident: Incident;

  const CLOUDWATCH_ALERT: RawAlert = {
    source: 'cloudwatch',
    externalId: `oom-alert-${Date.now()}`,
    payload: {
      AlarmName: 'payment-service-memory-critical',
      NewStateValue: 'ALARM',
      NewStateReason: 'Threshold Crossed: 1 out of 1 datapoints [95.2 (17/02/2026 10:00:00)] was greater than the threshold (90.0).',
      Trigger: { Namespace: 'AWS/ECS' },
      Region: 'us-east-1',
      AlarmArn: 'arn:aws:cloudwatch:us-east-1:000000000000:alarm:payment-service-memory-critical',
    },
  };

  beforeAll(async () => {
    harness = await createE2EHarness();

    // Inject OOM scenario data into Customer LocalStack
    await injectOOMScenario({
      tenantId: harness.testTenant.tenantId,
      serviceName: 'payment-service',
      timestamp: new Date(),
    });

    // Seed knowledge graph with service topology
    await seedServiceGraph(undefined, harness.testTenant.tenantId);
  }, 60_000);

  afterAll(async () => {
    await harness.cleanup();
  });

  it('should ingest CloudWatch alert and create incident', async () => {
    incident = await harness.ctx.webhookUseCases.ingestAlert.execute(
      harness.testTenant.tenantId,
      CLOUDWATCH_ALERT,
    );

    expect(incident).toBeDefined();
    expect(incident.status).toBe('open');
    expect(incident.sourceProvider).toBe('cloudwatch');
    expect(incident.title).toBe('payment-service-memory-critical');
    expect(incident.severity).toBe('critical');

    // Verify incident.created event was emitted
    const createdEvent = findEvent(harness.events, 'incident.created');
    expect(createdEvent).toBeDefined();
    expect(createdEvent!.payload['incidentId']).toBe(incident.incidentId);
  });

  it('should triage via stub LLM and transition to triaging', async () => {
    // Wait for in-process pipeline to complete triage
    await waitForEvent(harness.events, 'incident.status_changed', 15_000);

    const statusEvents = findEvents(harness.events, 'incident.status_changed');
    const triageEvent = statusEvents.find((e) => e.payload['to'] === 'triaging');
    expect(triageEvent).toBeDefined();
    expect(triageEvent!.payload['incidentId']).toBe(incident.incidentId);

    // Verify stub LLM was called for triage
    const triageCalls = harness.stubLLM.getCallLog().filter((c) => c.type === 'triage');
    expect(triageCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should investigate with agents calling real CloudProvider', async () => {
    // Wait for investigation to complete (agents call real CloudProvider against Customer LocalStack)
    await waitForEvent(harness.events, 'investigation.completed', 60_000);

    const invEvent = findEvent(harness.events, 'investigation.completed');
    expect(invEvent).toBeDefined();
    expect(invEvent!.payload['incidentId']).toBe(incident.incidentId);
    expect(invEvent!.payload['agentsUsed']).toBeDefined();

    // Verify stub agents actually ran and called tools
    const runLog = harness.stubAgent.getRunLog();
    expect(runLog.length).toBeGreaterThanOrEqual(1);

    // At least one agent should have made tool calls
    const totalToolCalls = runLog.reduce((sum, entry) => sum + entry.toolCalls.length, 0);
    expect(totalToolCalls).toBeGreaterThanOrEqual(1);
  });

  it('should synthesize investigation results via stub LLM', async () => {
    const synthesisCalls = harness.stubLLM.getCallLog().filter((c) => c.type === 'synthesis');
    expect(synthesisCalls.length).toBeGreaterThanOrEqual(1);

    // Verify the incident was updated with root cause
    const updated = await harness.ctx.incidentUseCases.getIncident.execute(
      harness.testTenant.tenantId,
      incident.incidentId,
    );
    expect(updated.rootCause).toBeDefined();
    expect(updated.rootCause).toContain('OOM');
  });

  it('should propose remediation automatically', async () => {
    // The in-process pipeline should have triggered remediation proposal
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

  it('should have audit trail for all actions', async () => {
    // Give audit entries time to be written
    await new Promise((r) => setTimeout(r, 1000));

    const auditResult = await harness.ctx.auditUseCases.listAuditEntries.execute({
      tenantId: harness.testTenant.tenantId,
      limit: 50,
    });

    const auditActions = auditResult.items.map((e) => e.action);

    expect(auditActions).toContain('incident.created');
    expect(auditActions).toContain('incident.status_changed');
    expect(auditActions).toContain('investigation.completed');
  });
});
