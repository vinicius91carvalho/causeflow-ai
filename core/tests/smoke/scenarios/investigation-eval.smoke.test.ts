import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSmokeHarness } from '../helpers/smoke-harness.js';
import type { SmokeHarness } from '../helpers/smoke-harness.js';
import { CustomerClient } from '../helpers/customer-client.js';
import { OrderClient } from '../helpers/order-client.js';
import { waitForCWLog } from '../helpers/cw-waiter.js';
import { waitForEventByIncident } from '../helpers/event-scoper.js';
import { seedServiceGraph } from '../../e2e/scenarios/graph-seeder.js';
import { SMOKE_EVAL_SCENARIOS } from '../helpers/smoke-eval-scenarios.js';
import type { SmokeEvalScenario } from '../helpers/smoke-eval-scenarios.js';
import { evaluateResult, scoreRootCause } from '../../eval/eval-framework.js';
import type { EvalResult } from '../../eval/eval-framework.js';
import { printEvalReport } from '../helpers/eval-reporter.js';
import { launchRelayContainer, waitForRelayConnection, stopRelayContainer } from '../helpers/docker-relay-launcher.js';

const LOG_GROUP_PAYMENT = '/ecs/payment-service';
const LOG_GROUP_ORDER = '/ecs/order-service';
const SMOKE_PORT = Number(process.env['PORT'] ?? '3099');

describe('Smoke: Investigation Eval (Single Tenant)', () => {
  let harness: SmokeHarness;
  let customer: CustomerClient;
  let orderClient: OrderClient;
  const evalResults: EvalResult[] = [];

  beforeAll(async () => {
    customer = new CustomerClient();
    orderClient = new OrderClient();
    harness = await createSmokeHarness({ enableRelay: true });

    // Seed service graph (once)
    await seedServiceGraph(undefined, harness.testTenant.tenantId);

    // Launch real relay container (connects to order-postgres via customer-vpc)
    await launchRelayContainer({
      tenantId: harness.testTenant.tenantId,
      controlPlanePort: SMOKE_PORT,
      token: process.env['JWT_SECRET'] ?? 'smoke-test-secret',
    });
    await waitForRelayConnection(
      () => harness.relayRegistry!.isConnected(harness.testTenant.tenantId),
      60_000,
    );
  }, 180_000);

  afterAll(async () => {
    stopRelayContainer();
    printEvalReport(evalResults);
    await harness.cleanup();
  });

  // ── Per-scenario test suites ────────────────────────────────────────
  for (const scenario of SMOKE_EVAL_SCENARIOS) {
    describeScenario(scenario);
  }

  // ── Global pass-rate assertion ──────────────────────────────────────
  it('all scenarios should meet 90% pass rate', () => {
    const passed = evalResults.filter((r) => r.passed).length;
    const total = evalResults.length;
    expect(total).toBeGreaterThan(0);
    expect(passed / total).toBeGreaterThanOrEqual(0.90);
  });

  // ── Scenario factory ───────────────────────────────────────────────
  function describeScenario(scenario: SmokeEvalScenario) {
    describe(`Scenario: ${scenario.name}`, () => {
      let incidentId: string;
      let startTime: number;

      it('setup scenario and trigger bug', async () => {
        const clients = { payment: customer, order: orderClient };
        await scenario.setupScenario(clients);
        await scenario.generateTraffic(clients);
        const logGroup = scenario.name.includes('Order') || scenario.name.includes('Race')
          ? LOG_GROUP_ORDER
          : LOG_GROUP_PAYMENT;
        await waitForCWLog(logGroup, scenario.cwLogPattern, 60_000);
      }, 120_000);

      it('ingest alert and create incident', async () => {
        startTime = Date.now();
        const result = await harness.apiClient.sendAlert(
          harness.testTenant.tenantId,
          scenario.alertSource,
          scenario.alertPayload,
        );

        expect(result.status).toBe('accepted');
        expect(result.incidentId).toBeDefined();
        incidentId = result.incidentId;
      });

      it('complete investigation with correct root cause', async () => {
        const invEvent = await waitForEventByIncident(
          harness.events,
          'investigation.completed',
          incidentId,
          120_000,
        );

        const rootCause = invEvent.payload['rootCause'] as string;
        expect(rootCause).toBeDefined();
        expect(rootCause.length).toBeGreaterThan(10);

        // Score root cause with eval-framework keywords
        const rootCauseMatch = scoreRootCause(rootCause, scenario.expectedRootCause);
        console.log(`[Eval] ${scenario.name} | rootCause: ${rootCause.slice(0, 200)}`);
        console.log(`[Eval] ${scenario.name} | rootCauseMatch: ${rootCauseMatch}`);

        // Fetch incident for severity + actions
        const incident = await harness.apiClient.getIncident(
          harness.testTenant.tenantId,
          incidentId,
        );

        const latencyMs = Date.now() - startTime;
        const actions = (invEvent.payload['recommendedActions'] as Array<{ action: string }>) ?? [];

        const evalResult = evaluateResult(scenario.evalScenario, {
          severity: (incident['severity'] as string) ?? 'critical',
          rootCause,
          actions,
          latencyMs,
          costUsd: (invEvent.payload['totalCostUsd'] as number) ?? 0,
        });

        evalResults.push(evalResult);

        // Business assertion: root cause must match
        expect(rootCauseMatch).toBe(true);
      }, 130_000);

      it('proposed fix targets correct file', async () => {
        const invEvent = await waitForEventByIncident(
          harness.events,
          'investigation.completed',
          incidentId,
          5_000,
        ).catch(() => null);

        // proposedFix is optional — only assert when present
        if (invEvent) {
          const proposedFix = invEvent.payload['proposedFix'] as {
            files: Array<{ path: string; content: string }>;
          } | undefined;

          if (proposedFix) {
            expect(proposedFix.files.length).toBeGreaterThan(0);
            const paths = proposedFix.files.map((f) => f.path).join(' ');
            expect(paths.toLowerCase()).toMatch(/payment/);
            const contents = proposedFix.files.map((f) => f.content).join(' ');
            expect(contents).toMatch(/release|finally/i);
          }
        }
      }, 15_000);

      it('db_analyst agent was used (relay active)', async () => {
        if (!scenario.name.includes('Race')) return; // only for relay-relevant scenarios
        const invEvent = await waitForEventByIncident(harness.events, 'investigation.completed', incidentId, 5_000);
        const agentsUsed = invEvent.payload['agentsUsed'] as string[];
        expect(agentsUsed).toContain('db_analyst');
      }, 15_000);

      it('cost breakdown includes all components', async () => {
        const invEvent = await waitForEventByIncident(harness.events, 'investigation.completed', incidentId, 5_000);
        const breakdown = invEvent.payload['costBreakdown'] as { subAgents: number; synthesis: number; codeFixer: number };
        expect(breakdown).toBeDefined();
        expect(breakdown.synthesis).toBeGreaterThan(0);
        expect(breakdown.subAgents).toBeGreaterThan(0);
        const totalCost = invEvent.payload['totalCostUsd'] as number;
        expect(totalCost).toBeCloseTo(breakdown.subAgents + breakdown.synthesis + breakdown.codeFixer, 6);
      }, 15_000);

      it('propose remediation', async () => {
        const proposedEvent = await waitForEventByIncident(
          harness.events,
          'remediation.proposed',
          incidentId,
          90_000,
        );

        expect(proposedEvent.payload['remediationId']).toBeDefined();
      }, 100_000);

      it('approve remediation and execute', async () => {
        // 1. Get remediationId from the proposed event
        const proposedEvent = await waitForEventByIncident(
          harness.events,
          'remediation.proposed',
          incidentId,
          5_000,
        );
        const remediationId = proposedEvent.payload['remediationId'] as string;
        expect(remediationId).toBeDefined();

        // 2. Approve via HTTP API (human approval simulation)
        const approved = await harness.apiClient.approveRemediation(
          harness.testTenant.tenantId,
          remediationId,
        );
        expect(approved['status']).toBe('approved');

        // 3. Wait for auto-execution (bootstrap wires remediation.approved → executeRemediation)
        const executedEvent = await waitForEventByIncident(
          harness.events,
          'remediation.executed',
          incidentId,
          60_000,
        );

        expect(executedEvent.payload['remediationId']).toBe(remediationId);
        const stepsCompleted = executedEvent.payload['stepsCompleted'] as number;
        const totalSteps = executedEvent.payload['totalSteps'] as number;
        expect(totalSteps).toBeGreaterThan(0);
        console.log(`[Smoke] Remediation executed: ${stepsCompleted}/${totalSteps} steps completed`);

        // 4. Fetch remediation detail and verify PR info
        const detail = await harness.apiClient.getRemediationDetail(
          harness.testTenant.tenantId,
          remediationId,
        );
        expect(detail['status']).toMatch(/completed|failed/);

        const steps = detail['steps'] as Array<{ action: string; status: string; output?: string }>;
        const fixPrStep = steps?.find((s) => s.action === 'create_fix_pr');
        if (fixPrStep) {
          console.log(`[Smoke] create_fix_pr step: ${fixPrStep.status} — ${fixPrStep.output ?? 'no output'}`);
        }

        // pullRequests is populated when PR was successfully created
        const pullRequests = detail['pullRequests'] as Array<{
          repoFullName: string; prNumber: number; prUrl: string; branch: string; status: string;
        }> | undefined;

        if (pullRequests && pullRequests.length > 0) {
          const pr = pullRequests[0]!;
          expect(pr.prNumber).toBeGreaterThan(0);
          expect(pr.branch).toContain('fix/incident-');
          expect(pr.status).toBe('open');
          console.log(`[Smoke] PR created: #${pr.prNumber} on ${pr.repoFullName} (${pr.prUrl})`);
        } else {
          console.log('[Smoke] No PR created — create_fix_pr may have been skipped');
        }
      }, 120_000);
    });
  }
});
