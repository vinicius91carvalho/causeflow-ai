import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EHarness, findEvents } from './helpers/e2e-test-harness.js';
import type { E2EHarness } from './helpers/e2e-test-harness.js';
import { injectOOMScenario } from './scenarios/scenario-injector.js';
import type { RawAlert } from '../../src/shared/application/ports/alert-source.port.js';

describe('E2E Pipeline: Alert Deduplication', () => {
  let harness: E2EHarness;

  const EXTERNAL_ID = `dedup-alert-${Date.now()}`;

  const CLOUDWATCH_ALERT: RawAlert = {
    source: 'cloudwatch',
    externalId: EXTERNAL_ID,
    payload: {
      AlarmName: 'payment-service-cpu-critical',
      NewStateValue: 'ALARM',
      NewStateReason: 'CPU utilization exceeded threshold',
      Trigger: { Namespace: 'AWS/ECS' },
      Region: 'us-east-1',
    },
  };

  beforeAll(async () => {
    harness = await createE2EHarness();

    await injectOOMScenario({
      tenantId: harness.testTenant.tenantId,
      serviceName: 'payment-service',
      timestamp: new Date(),
    });
  }, 60_000);

  afterAll(async () => {
    await harness.cleanup();
  });

  it('should create only one incident when same alert is ingested 3 times', async () => {
    // Ingest the same alert 3 times sequentially to test dedup logic
    const result1 = await harness.ctx.webhookUseCases.ingestAlert.execute(
      harness.testTenant.tenantId,
      CLOUDWATCH_ALERT,
    );
    const result2 = await harness.ctx.webhookUseCases.ingestAlert.execute(
      harness.testTenant.tenantId,
      CLOUDWATCH_ALERT,
    );
    const result3 = await harness.ctx.webhookUseCases.ingestAlert.execute(
      harness.testTenant.tenantId,
      CLOUDWATCH_ALERT,
    );
    const results = [result1, result2, result3];

    // All 3 calls should return the same incident
    const incidentIds = new Set(results.map((r) => r.incidentId));
    expect(incidentIds.size).toBe(1);

    // All should have the same status
    expect(results[0]?.sourceAlertId).toBe(EXTERNAL_ID);
    expect(results[1]?.sourceAlertId).toBe(EXTERNAL_ID);
    expect(results[2]?.sourceAlertId).toBe(EXTERNAL_ID);
  });

  it('should emit incident.created only once for deduplicated alerts', async () => {
    // Wait a bit for async event handlers
    await new Promise((r) => setTimeout(r, 2000));

    const createdEvents = findEvents(harness.events, 'incident.created');
    // Only 1 incident.created for this alert's external ID
    const relevantEvents = createdEvents.filter(
      (e) => e.payload['title'] === 'payment-service-cpu-critical',
    );
    expect(relevantEvents.length).toBe(1);
  });

  it('should create separate incidents for different alert external IDs', async () => {
    const differentAlert: RawAlert = {
      source: 'cloudwatch',
      externalId: `different-alert-${Date.now()}`,
      payload: {
        AlarmName: 'order-service-error-rate',
        NewStateValue: 'ALARM',
        NewStateReason: 'Error rate exceeded 5%',
        Trigger: { Namespace: 'AWS/ECS' },
        Region: 'us-east-1',
      },
    };

    const incident1 = await harness.ctx.webhookUseCases.ingestAlert.execute(
      harness.testTenant.tenantId,
      CLOUDWATCH_ALERT,
    );
    const incident2 = await harness.ctx.webhookUseCases.ingestAlert.execute(
      harness.testTenant.tenantId,
      differentAlert,
    );

    expect(incident1.incidentId).not.toBe(incident2.incidentId);
    expect(incident1.sourceAlertId).toBe(EXTERNAL_ID);
    expect(incident2.title).toBe('order-service-error-rate');
  });
});
