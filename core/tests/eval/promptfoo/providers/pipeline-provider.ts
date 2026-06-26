/* eslint-disable */
import type { ApiProvider, ProviderOptions, ProviderResponse, CallApiContextParams } from 'promptfoo';
import type { AppContext } from '../../../../src/bootstrap.js';
import type { DomainEvent } from '../../../../src/shared/domain/events.js';
import type { Tenant } from '../../../../src/modules/tenant/domain/tenant.entity.js';
import { injectOOMScenario, injectLatencySpike, injectCascadingFailure } from '../../../e2e/scenarios/scenario-injector.js';
import { seedServiceGraph } from '../../../e2e/scenarios/graph-seeder.js';

interface PipelineInput {
  alert: {
    source: string;
    externalId: string;
    payload: Record<string, unknown>;
  };
  inject: 'oom' | 'latency' | 'cascading';
  service: string;
}

export default class PipelineProvider implements ApiProvider {
  private ctx: AppContext | null = null;
  private testTenant: Tenant | null = null;
  private events: DomainEvent[] = [];
  private readonly providerId: string;

  constructor(options: ProviderOptions) {
    this.providerId = options.id ?? 'causeflow:pipeline';
  }

  id(): string {
    return this.providerId;
  }

  private async ensureBootstrapped(): Promise<void> {
    if (this.ctx) return;

    const { bootstrap } = await import('../../../../src/bootstrap.js');
    this.ctx = bootstrap();

    // Tap EventBus
    const originalPublish = this.ctx.eventBus.publish.bind(this.ctx.eventBus);
    this.ctx.eventBus.publish = async (event: DomainEvent) => {
      this.events.push(event);
      return originalPublish(event);
    };

    // Create test tenant
    this.testTenant = await this.ctx.tenantUseCases.createTenant.execute({
      name: 'Eval Pipeline Corp',
      slug: `eval-pipeline-${Date.now()}`,
      ownerEmail: 'eval@pipeline.com',
      plan: 'enterprise',
    });

    // Seed graph topology
    await seedServiceGraph(undefined, this.testTenant.tenantId);
  }

  async callApi(prompt: string, _context?: CallApiContextParams): Promise<ProviderResponse> {
    const start = Date.now();

    try {
      await this.ensureBootstrapped();
      const input: PipelineInput = JSON.parse(prompt);

      // Reset events per call
      this.events = [];

      const now = new Date();

      // Inject scenario into Customer LocalStack
      const scenarioCtx = {
        tenantId: this.testTenant!.tenantId,
        serviceName: input.service,
        timestamp: now,
      };

      switch (input.inject) {
        case 'oom':
          await injectOOMScenario(scenarioCtx);
          break;
        case 'latency':
          await injectLatencySpike(scenarioCtx);
          break;
        case 'cascading':
          await injectCascadingFailure(scenarioCtx);
          break;
      }

      // Ingest alert (triggers full in-process pipeline)
      const incident = await this.ctx!.webhookUseCases.ingestAlert.execute(
        this.testTenant!.tenantId,
        {
          source: input.alert.source,
          externalId: `${input.alert.externalId}-${Date.now()}`,
          payload: input.alert.payload,
        },
      );

      // Wait for pipeline completion (in-process, EventBus-driven)
      const maxWait = 90_000;
      const deadline = Date.now() + maxWait;
      while (Date.now() < deadline) {
        const hasInvestigation = this.events.some((e) => e.eventType === 'investigation.completed');
        if (hasInvestigation) break;
        await new Promise((r) => setTimeout(r, 500));
      }

      // Gather results
      const investigationEvent = this.events.find((e) => e.eventType === 'investigation.completed');
      const remediationEvent = this.events.find((e) => e.eventType === 'remediation.proposed');
      const latencyMs = Date.now() - start;

      // Fetch updated incident
      const updatedIncident = await this.ctx!.incidentUseCases.getIncident.execute(
        this.testTenant!.tenantId,
        incident.incidentId,
      );

      const invPayload = investigationEvent?.payload;
      const remPayload = remediationEvent?.payload;
      const rawActions = remPayload?.['recommendedActions'];

      const result = {
        severity: updatedIncident?.severity ?? incident.severity,
        rootCause: typeof invPayload?.['rootCause'] === 'string'
          ? invPayload['rootCause']
          : 'No root cause determined',
        actions: Array.isArray(rawActions) ? (rawActions as Array<{ action: string }>) : [],
        eventsEmitted: this.events.map((e) => e.eventType),
        latencyMs,
        costUsd: 0,
      };

      return {
        output: JSON.stringify(result),
        cost: result.costUsd,
        metadata: { latencyMs, eventsCount: this.events.length },
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        metadata: { latencyMs: Date.now() - start },
      };
    }
  }
}
