import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EHarness, assertEventSequence, waitForEvent } from './helpers/e2e-test-harness.js';
import type { E2EHarness } from './helpers/e2e-test-harness.js';
import { injectLatencySpike } from './scenarios/scenario-injector.js';
import { seedServiceGraph } from './scenarios/graph-seeder.js';
import { FixtureCodeRepository } from '../fixtures/fixture-code-repository.js';
import { configRegression } from '../fixtures/scenarios/index.js';
import type { RawAlert } from '../../src/shared/application/ports/alert-source.port.js';
import type { Incident } from '../../src/modules/ingestion/domain/incident.entity.js';

describe('E2E Pipeline: Config Regression with Code Analysis', () => {
  let harness: E2EHarness;
  let incident: Incident;

  const CLOUDWATCH_ALERT: RawAlert = {
    source: 'cloudwatch',
    externalId: `config-reg-${Date.now()}`,
    payload: {
      AlarmName: 'payment-service-latency-high',
      NewStateValue: 'ALARM',
      NewStateReason:
        'Threshold Crossed: Request timeout errors increased 500%. Average latency exceeded 3000ms.',
      Trigger: { Namespace: 'Custom/App' },
      Region: 'us-east-1',
      AlarmArn: 'arn:aws:cloudwatch:us-east-1:000000000000:alarm:payment-service-latency-high',
    },
  };

  beforeAll(async () => {
    const codeRepo = new FixtureCodeRepository(configRegression);

    harness = await createE2EHarness({ codeRepo });

    // Configure change_detector to find the config change
    harness.stubAgent.setAgentResponse('change_detector', {
      response:
        'Change detection: Commit cr02bbbb changed requestTimeoutMs from 30000 to 3000 in config.ts — a typo that reduced timeout from 30s to 3s, causing request failures.',
      toolCallsToMake: [
        {
          name: 'describe_service',
          input: { serviceName: 'payment-service', region: 'us-east-1' },
        },
        { name: 'get_recent_changes', input: { service: 'payment-service' } },
        { name: 'get_file_content', input: { service: 'payment-service', path: 'src/config.ts' } },
      ],
    });

    // Configure synthesis mentioning config regression
    harness.stubLLM.setScenario({
      triage: {
        priority: 'critical',
        suggestedAgents: ['log_analyst', 'metric_analyst', 'infra_inspector', 'change_detector'],
        summary:
          'Payment service experiencing high latency and timeout errors after recent deployment',
        confidence: 0.95,
        category: 'application',
        investigationMode: 'orchestrator',
      },
      synthesis: {
        potentialRootCause:
          'Configuration regression — requestTimeoutMs changed from 30000 to 3000 (typo) in commit cr02bbbb, causing all requests longer than 3s to timeout',
        recommendedActions: [
          {
            action: 'restart_service',
            params: { service: 'payment-service', cluster: 'production' },
          },
        ],
        findings: [
          {
            text: 'Commit cr02bbbb changed REQUEST_TIMEOUT_MS default from 30000 to 3000',
            evidenceIds: ['ev-1'],
          },
          { text: 'This is a typo: 3s timeout instead of 30s', evidenceIds: ['ev-2'] },
          { text: 'All database queries > 3s now fail with timeout error', evidenceIds: ['ev-3'] },
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
      CLOUDWATCH_ALERT,
    );

    expect(incident).toBeDefined();
    expect(incident.status).toBe('open');
  });

  it('should investigate with change_detector reading config file', async () => {
    await waitForEvent(harness.events, 'investigation.completed', 60_000);

    const runLog = harness.stubAgent.getRunLog();
    const changeDetectorRun = runLog.find((r) => r.role === 'change_detector');
    expect(changeDetectorRun).toBeDefined();

    // Verify change_detector called get_file_content
    const toolNames = changeDetectorRun!.toolCalls.map((t) => t.name);
    expect(toolNames).toContain('get_file_content');

    // Verify the file content shows the buggy timeout value
    const fileCall = changeDetectorRun!.toolCalls.find((t) => t.name === 'get_file_content');
    expect(fileCall).toBeDefined();
    const fileOutput = JSON.parse(fileCall!.output);
    expect(fileOutput.content).toContain('3000');
    expect(fileOutput.content).toContain('requestTimeoutMs');
  });

  it('should synthesize root cause mentioning config and timeout', async () => {
    const updated = await harness.ctx.incidentUseCases.getIncident.execute(
      harness.testTenant.tenantId,
      incident.incidentId,
    );

    expect(updated.rootCause).toBeDefined();
    const rootLower = updated.rootCause!.toLowerCase();
    expect(rootLower).toMatch(/config|timeout/);
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
