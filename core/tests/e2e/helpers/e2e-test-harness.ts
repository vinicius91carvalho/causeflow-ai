import { bootstrap } from '../../../src/bootstrap.js';
import type { AppContext } from '../../../src/bootstrap.js';
import type { DomainEvent } from '../../../src/shared/domain/events.js';
import { DeterministicLLMClient } from '../stubs/deterministic-llm-client.js';
import { DeterministicAgentRunner } from '../stubs/deterministic-agent-runner.js';
import type { Tenant } from '../../../src/modules/tenant/domain/tenant.entity.js';

export type E2EHarnessOptions = Record<string, unknown>;

export interface E2EHarness {
  ctx: AppContext;
  stubLLM: DeterministicLLMClient;
  stubAgent: DeterministicAgentRunner;
  events: DomainEvent[];
  testTenant: Tenant;
  cleanup: () => Promise<void>;
}

export async function createE2EHarness(_opts?: E2EHarnessOptions): Promise<E2EHarness> {
  const stubLLM = new DeterministicLLMClient();
  const stubAgent = new DeterministicAgentRunner();

  const ctx = await bootstrap({
    llmClient: stubLLM,
    agentRunner: stubAgent,
  });

  // Tap on EventBus to capture all events
  const events: DomainEvent[] = [];
  const originalPublish = ctx.eventBus.publish.bind(ctx.eventBus);
  ctx.eventBus.publish = async (event: DomainEvent) => {
    events.push(event);
    return originalPublish(event);
  };

  // Create test tenant
  const testTenant = await ctx.tenantUseCases.createTenant.execute({
    name: 'E2E Test Corp',
    slug: `e2e-test-${Date.now()}`,
    ownerEmail: 'e2e@test.com',
    plan: 'enterprise',
  });

  const cleanup = async () => {
    for (const consumer of ctx.consumers) {
      consumer.stop();
    }
    stubLLM.reset();
    stubAgent.reset();
  };

  return { ctx, stubLLM, stubAgent, events, testTenant, cleanup };
}

export function findEvent(events: DomainEvent[], eventType: string): DomainEvent | undefined {
  return events.find((e) => e.eventType === eventType);
}

export function findEvents(events: DomainEvent[], eventType: string): DomainEvent[] {
  return events.filter((e) => e.eventType === eventType);
}

export function assertEventSequence(events: DomainEvent[], expectedSequence: string[]): void {
  const relevantEvents = events
    .filter((e) => expectedSequence.includes(e.eventType))
    .map((e) => e.eventType);

  // Check that all expected events are present
  for (const expected of expectedSequence) {
    if (!relevantEvents.includes(expected)) {
      throw new Error(`Expected event '${expected}' not found. Got: [${relevantEvents.join(', ')}]`);
    }
  }

  // Check order (allow extra events between expected ones)
  let lastIndex = -1;
  for (const expected of expectedSequence) {
    const idx = relevantEvents.indexOf(expected, lastIndex + 1);
    if (idx === -1) {
      // Might have been consumed already at an earlier position; search from 0
      const fallbackIdx = relevantEvents.indexOf(expected);
      if (fallbackIdx <= lastIndex) {
        throw new Error(
          `Event '${expected}' found at index ${fallbackIdx} but expected after index ${lastIndex}. Sequence: [${relevantEvents.join(', ')}]`,
        );
      }
    } else {
      lastIndex = idx;
    }
  }
}

export async function waitForEvent(
  events: DomainEvent[],
  eventType: string,
  timeoutMs = 30000,
): Promise<DomainEvent> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const event = findEvent(events, eventType);
    if (event) return event;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for event '${eventType}' after ${timeoutMs}ms`);
}
