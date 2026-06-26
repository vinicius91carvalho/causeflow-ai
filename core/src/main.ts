import './shared/infra/observability/otel.js';
import { shutdownOtel } from './shared/infra/observability/otel.js';
import { initSentry } from './shared/infra/observability/sentry.js';
initSentry();
import { serve } from '@hono/node-server';
import type { Server as HttpServer } from 'node:http';
import { config } from './shared/config/index.js';
import { logger } from './shared/infra/logger.js';
import { ensureTable } from './shared/infra/db/table.js';
import { bootstrap } from './bootstrap.js';
import type { AppContext } from './bootstrap.js';
import { createApp } from './app.js';
import { AppLifecycle } from './lifecycle.js';
import { closeRedis } from './shared/infra/cache/redis-client.js';
import { InProcessScheduler } from './shared/infra/scheduler/scheduler.js';
import { RelayRegistry } from './shared/infra/relay/relay-registry.js';
import { WssRelayGateway } from './shared/infra/relay/relay-gateway.js';
import { createRelayWSServer } from './shared/infra/relay/relay-ws-server.js';
import { InvestigationRelayRegistry, createInvestigationRelayServer } from './shared/infra/relay/investigation-relay-server.js';

async function main() {
  logger.info({ env: config.env }, 'Starting CauseFlow...');

  // Ensure DynamoDB table exists (dev/LocalStack only)
  if (config.isDev()) {
    await ensureTable();
  }

  // Relay Registry + Gateway (conditional)
  let relayRegistry: RelayRegistry | undefined;
  let relayGateway: WssRelayGateway | undefined;
  if (config.relay.enabled) {
    relayRegistry = new RelayRegistry();
    relayGateway = new WssRelayGateway(relayRegistry);
    logger.info({ wsPath: config.relay.wsPath }, 'Relay enabled');
  }

  const ctx = await bootstrap({ relayGateway });
  const app = createApp(ctx);

  // Seed dev tenants (idempotent — skips if already exist)
  if (config.isDev()) {
    await seedDevTenants(ctx);
  }

  // Scheduled Jobs
  const scheduler = new InProcessScheduler();
  scheduler.start([
    {
      name: 'cleanup-stale-incidents',
      intervalMs: 60 * 60 * 1000, // 1 hour
      execute: () => {
        logger.info('Scheduled: cleanup-stale-incidents (placeholder - requires tenant list)');
        return Promise.resolve();
      },
    },
    {
      name: 'maintenance-patterns',
      intervalMs: 6 * 60 * 60 * 1000, // 6 hours
      execute: () => {
        logger.info('Scheduled: maintenance-patterns (placeholder - requires tenant list)');
        return Promise.resolve();
      },
    },
    {
      name: 'timeout-stale-remediations',
      intervalMs: 60 * 60 * 1000, // 1 hour
      execute: () => {
        logger.info('Scheduled: timeout-stale-remediations (placeholder - requires tenant list)');
        return Promise.resolve();
      },
    },
  ]);

  // Graceful shutdown
  const lifecycle = new AppLifecycle(30_000);

  // Stop scheduler first
  lifecycle.register({
    name: 'scheduler',
    shutdown: () => scheduler.stop(),
  });

  // Stop consumers (stop receiving new work)
  if (ctx.consumers.length > 0) {
    lifecycle.register({
      name: 'sqs-consumers',
      shutdown: () => {
        for (const consumer of ctx.consumers) {
          consumer.stop();
        }
        return Promise.resolve();
      },
    });
  }

  // Then SSE manager (close SSE connections)
  lifecycle.register({
    name: 'sse-manager',
    shutdown: () => { ctx.sseManager.shutdown(); return Promise.resolve(); },
  });

  // Finally close Redis (used by rate limiter etc.)
  lifecycle.register({
    name: 'redis',
    shutdown: closeRedis,
  });

  // Flush and shutdown OTel SDK (after all app work is done)
  lifecycle.register({
    name: 'otel',
    shutdown: async () => {
      await shutdownOtel();
      logger.info({ event: 'otel.shutdown.complete' }, 'otel.shutdown.complete');
    },
  });

  lifecycle.install();

  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    logger.info({ port: info.port }, 'CauseFlow is running');
  });

  // Attach WebSocket server for relay connections
  if (relayRegistry && config.relay.enabled) {
    const registry = relayRegistry;
    createRelayWSServer(server as HttpServer, registry, config.relay.wsPath);
    logger.info({ wsPath: config.relay.wsPath }, 'Relay WSS server attached');

    lifecycle.register({
      name: 'relay-registry',
      shutdown: () => { registry.shutdown(); return Promise.resolve(); },
    });
  }

  // Attach Investigation relay WebSocket server
  const investigationRelay = new InvestigationRelayRegistry();
  // Wire on-demand followup dispatch — relay server triggers this when a dashboard
  // sends guidance but no worker is currently connected for the session.
  if (config.ecs.cluster) {
    investigationRelay.setDispatcher(async (tid, iid) => {
      const { dispatchInvestigation } = await import('./shared/infra/ecs/task-dispatcher.js');
      await dispatchInvestigation({ incidentId: iid, tenantId: tid, suggestedAgents: [], mode: 'followup' });
    });
  }
  createInvestigationRelayServer(
    server as HttpServer,
    investigationRelay,
    config.webhook.secret, // reuse webhook secret as relay auth token
    '/v1/investigation/ws',
  );
  logger.info({ wsPath: '/v1/investigation/ws' }, 'Investigation relay WSS server attached');

  lifecycle.register({
    name: 'investigation-relay',
    shutdown: () => { investigationRelay.shutdown(); return Promise.resolve(); },
  });
}

const DEV_TENANTS = [
  {
    name: 'Billing Corp',
    slug: 'billing-corp',
    ownerEmail: 'admin@causeflow.ai',
    settings: {},
  },
  {
    name: 'Marketplace Inc',
    slug: 'marketplace-inc',
    ownerEmail: 'admin@causeflow.ai',
    settings: {},
  },
  {
    name: 'TechCorp',
    slug: 'techcorp',
    ownerEmail: 'admin@causeflow.ai',
    settings: {},
  },
];

async function seedDevTenants(ctx: AppContext): Promise<void> {
  for (const def of DEV_TENANTS) {
    try {
      const tenant = await ctx.tenantUseCases.createTenant.execute({
        name: def.name,
        slug: def.slug,
        ownerEmail: def.ownerEmail,
        plan: 'enterprise',
        settings: def.settings,
      });
      // Seed with enterprise plan settings
      await ctx.tenantUseCases.updateTenant.execute(tenant.tenantId, {
        settings: def.settings,
      });
      logger.info({ tenantId: tenant.tenantId, slug: def.slug }, `Dev tenant seeded: ${def.name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('slug') && msg.includes('already')) {
        logger.debug({ slug: def.slug }, 'Dev tenant already exists, skipping');
      } else {
        logger.warn({ slug: def.slug, error: msg }, 'Failed to seed dev tenant');
      }
    }
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start CauseFlow');
  process.exit(1);
});
