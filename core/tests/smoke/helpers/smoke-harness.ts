import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import type { Server } from 'node:http';
import { bootstrap } from '../../../src/bootstrap.js';
import type { AppContext } from '../../../src/bootstrap.js';
import { createApp } from '../../../src/app.js';
import type { DomainEvent } from '../../../src/shared/domain/events.js';
import type { Tenant } from '../../../src/modules/tenant/domain/tenant.entity.js';
import type { IRelayGateway } from '../../../src/shared/application/ports/relay-gateway.port.js';
import { RelayRegistry } from '../../../src/shared/infra/relay/relay-registry.js';
import { WssRelayGateway } from '../../../src/shared/infra/relay/relay-gateway.js';
import { createRelayWSServer } from '../../../src/shared/infra/relay/relay-ws-server.js';
import { CauseFlowApiClient } from './api-client.js';

const SMOKE_PORT = Number(process.env['PORT'] ?? '3099');

export interface SmokeHarnessOptions {
  enableRelay?: boolean;
}

export interface SmokeHarness {
  ctx: AppContext;
  events: DomainEvent[];
  testTenant: Tenant;
  apiClient: CauseFlowApiClient;
  relayRegistry?: RelayRegistry;
  cleanup: () => Promise<void>;
}

/**
 * Creates a smoke test harness with REAL LLM + AgentRunner.
 *
 * Everything is real:
 * - AWSCloudProvider reads from Customer LocalStack
 * - STSCredentialVendor does real STS AssumeRole
 * - AnthropicClient calls real Anthropic API (Haiku for cost efficiency)
 * - AnthropicAgentRunner orchestrates real agent tool loops
 * - Server is started on HTTP for real API calls via CauseFlowApiClient
 */
export async function createSmokeHarness(opts?: SmokeHarnessOptions): Promise<SmokeHarness> {
  // Relay support (optional — enabled when RELAY_ENABLED=true)
  let relayRegistry: RelayRegistry | undefined;
  let relayGateway: IRelayGateway | undefined;
  if (opts?.enableRelay || process.env['RELAY_ENABLED'] === 'true') {
    relayRegistry = new RelayRegistry();
    relayGateway = new WssRelayGateway(relayRegistry);
  }

  // Bootstrap with real LLM/Agent — no overrides except optional relay
  const ctx = await bootstrap({
    relayGateway,
  });

  // Create Hono app and start HTTP server
  const app = createApp(ctx);
  const server: ServerType = await new Promise((resolve) => {
    const s = serve({ fetch: app.fetch, port: SMOKE_PORT }, () => {
      resolve(s);
    });
  });

  // Attach WSS for relay connections (if relay enabled)
  if (relayRegistry) {
    const wsPath = process.env['RELAY_WS_PATH'] ?? '/v1/relay/connect';
    createRelayWSServer(server as Server, relayRegistry, wsPath);
  }

  // Tap on EventBus to capture all events
  const events: DomainEvent[] = [];
  const originalPublish = ctx.eventBus.publish.bind(ctx.eventBus);
  ctx.eventBus.publish = async (event: DomainEvent) => {
    events.push(event);
    return originalPublish(event);
  };

  // Create API client configured with smoke env secrets
  const apiClient = new CauseFlowApiClient({
    baseUrl: `http://localhost:${SMOKE_PORT}`,
    jwtSecret: process.env['JWT_SECRET'] ?? 'smoke-test-secret',
    jwtIssuer: process.env['JWT_ISSUER'] ?? 'causeflow',
    jwtAudience: process.env['JWT_AUDIENCE'] ?? 'causeflow-api',
    webhookSecret: process.env['WEBHOOK_SECRET'] ?? 'smoke-webhook-secret',
  });

  // Create test tenant via HTTP (real onboarding flow)
  const slug = `smoke-test-${Date.now()}`;
  const tenantData = await apiClient.createTenant({
    name: 'Smoke Test Corp',
    slug,
    ownerEmail: 'smoke@test.com',
    plan: 'enterprise',
  });

  // Configure AWS settings via HTTP PATCH (tenant-aware credential vending)
  await apiClient.updateTenant(tenantData.tenantId, {
    settings: {
      awsRoleArn: process.env['AWS_ROLE_ARN'] ?? 'arn:aws:iam::000000000000:role/CauseFlowCrossAccountRole',
      awsExternalId: tenantData.tenantId,
      awsRegion: process.env['AWS_REGION'] ?? 'us-east-1',
    },
  });

  // Fetch the full tenant object for use in tests
  const fullTenant = await apiClient.getTenant(tenantData.tenantId) as unknown as Tenant;

  const cleanup = async () => {
    relayRegistry?.shutdown();
    for (const consumer of ctx.consumers) {
      consumer.stop();
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  };

  return { ctx, events, testTenant: fullTenant, apiClient, relayRegistry, cleanup };
}

export function findEvent(events: DomainEvent[], eventType: string): DomainEvent | undefined {
  return events.find((e) => e.eventType === eventType);
}

export function findEvents(events: DomainEvent[], eventType: string): DomainEvent[] {
  return events.filter((e) => e.eventType === eventType);
}

export async function waitForEvent(
  events: DomainEvent[],
  eventType: string,
  timeoutMs = 60_000,
): Promise<DomainEvent> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = findEvent(events, eventType);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Event ${eventType} not received within ${timeoutMs}ms. Events: ${events.map((e) => e.eventType).join(', ')}`);
}
