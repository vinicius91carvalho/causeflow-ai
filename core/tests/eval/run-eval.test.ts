import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootstrap } from '../../src/bootstrap.js';
import type { AppContext } from '../../src/bootstrap.js';
import type { DomainEvent } from '../../src/shared/domain/events.js';
import { injectOOMScenario, injectLatencySpike } from '../e2e/scenarios/scenario-injector.js';
import { EVAL_SCENARIOS } from './scenarios.js';
import { evaluateResult } from './eval-framework.js';
import type { EvalResult } from './eval-framework.js';

const SKIP = !process.env['ANTHROPIC_API_KEY'] || process.env['ANTHROPIC_API_KEY'] === 'stub-api-key-for-e2e';

describe.skipIf(SKIP)('LLM Eval Suite', () => {
  let ctx: AppContext;
  let events: DomainEvent[];

  beforeAll(async () => {
    // Bootstrap WITHOUT overrides — uses real LLM
    ctx = await bootstrap();

    // Tap EventBus
    events = [];
    const originalPublish = ctx.eventBus.publish.bind(ctx.eventBus);
    ctx.eventBus.publish = async (event: DomainEvent) => {
      events.push(event);
      return originalPublish(event);
    };
  }, 60_000);

  afterAll(async () => {
    for (const consumer of ctx.consumers) {
      consumer.stop();
    }
  });

  const scenarioInjectors: Record<string, (tenantId: string) => Promise<void>> = {
    'OOM Kill - Payment Service': async (tenantId) => {
      await injectOOMScenario({ tenantId, serviceName: 'payment-service', timestamp: new Date() });
    },
    'Database Connection Timeout - API Gateway': async (tenantId) => {
      await injectLatencySpike({ tenantId, serviceName: 'api-gateway', timestamp: new Date() });
    },
  };

  const results: EvalResult[] = [];

  for (const scenario of EVAL_SCENARIOS) {
    it(`should produce acceptable results for: ${scenario.name}`, async () => {
      // Create tenant for this eval
      const tenant = await ctx.tenantUseCases.createTenant.execute({
        name: `Eval - ${scenario.name}`,
        slug: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerEmail: 'eval@test.com',
        plan: 'enterprise',
      });

      // Inject scenario data
      const injector = scenarioInjectors[scenario.name];
      if (injector) {
        await injector(tenant.tenantId);
      }

      // Clear events for this scenario
      events.length = 0;
      const startTime = Date.now();

      // Ingest alert
      const incident = await ctx.webhookUseCases.ingestAlert.execute(
        tenant.tenantId,
        scenario.alertPayload,
      );

      // Wait for pipeline to complete
      const waitForCompletion = async (maxWait = 120_000): Promise<void> => {
        const deadline = Date.now() + maxWait;
        while (Date.now() < deadline) {
          const hasInvestigation = events.some((e) => e.eventType === 'investigation.completed');
          if (hasInvestigation) return;
          await new Promise((r) => setTimeout(r, 1000));
        }
        throw new Error(`Pipeline did not complete within ${maxWait}ms`);
      };

      await waitForCompletion();

      const latencyMs = Date.now() - startTime;

      // Get final incident state
      const finalIncident = await ctx.incidentUseCases.getIncident.execute(
        tenant.tenantId,
        incident.incidentId,
      );

      // Extract investigation event for actions
      const invEvent = events.find((e) => e.eventType === 'investigation.completed');
      const recommendedActions = (invEvent?.payload['recommendedActions'] as Array<{ action: string }>) ?? [];

      // Evaluate
      const evalResult = evaluateResult(scenario, {
        severity: incident.severity,
        rootCause: finalIncident.rootCause ?? '',
        actions: recommendedActions,
        latencyMs,
        costUsd: 0, // TODO: aggregate from agent results
      });

      results.push(evalResult);

      console.log(`\n📊 Eval: ${scenario.name}`);
      console.log(`  Triage accuracy: ${(evalResult.triageAccuracy * 100).toFixed(0)}%`);
      console.log(`  Root cause match: ${evalResult.rootCauseMatch ? '✅' : '❌'}`);
      console.log(`  Actions match: ${(evalResult.actionsMatch * 100).toFixed(0)}%`);
      console.log(`  Latency: ${evalResult.totalLatencyMs}ms`);
      console.log(`  Passed: ${evalResult.passed ? '✅' : '❌'}`);

      expect(evalResult.triageAccuracy).toBeGreaterThanOrEqual(0.5);
    }, 180_000);
  }

  it('should print eval summary', () => {
    if (results.length === 0) return;

    console.log('\n📋 EVAL SUMMARY');
    console.log('================');
    for (const r of results) {
      console.log(`${r.passed ? '✅' : '❌'} ${r.scenario} — triage: ${(r.triageAccuracy * 100).toFixed(0)}%, rca: ${r.rootCauseMatch}, actions: ${(r.actionsMatch * 100).toFixed(0)}%`);
    }
    const passRate = results.filter((r) => r.passed).length / results.length;
    console.log(`\nPass rate: ${(passRate * 100).toFixed(0)}% (${results.filter((r) => r.passed).length}/${results.length})`);
  });
});
