import './shared/infra/observability/otel.js';
import { shutdownOtel } from './shared/infra/observability/otel.js';
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
import { redriveDLQ } from './shared/infra/queue/dlq-redriver.js';
import { UsageRecordEntity } from './shared/infra/db/entities/UsageRecordEntity.js';
import { TenantEntity } from './shared/infra/db/entities/TenantEntity.js';
import { RelayRegistry } from './shared/infra/relay/relay-registry.js';
import { WssRelayGateway } from './shared/infra/relay/relay-gateway.js';
import { createRelayWSServer } from './shared/infra/relay/relay-ws-server.js';
import {
  InvestigationRelayRegistry,
  createInvestigationRelayServer,
} from './shared/infra/relay/investigation-relay-server.js';

async function main() {
  logger.info({ env: config.env, runtime: config.runtime }, 'Starting CauseFlow...');

  // Sentry: dynamically imported so @sentry/node is never loaded when
  // SENTRY_DSN is empty (AC-049). The call is async and fully no-op when
  // the env var is not set.
  const { initSentry } = await import('./shared/infra/observability/sentry.js');
  await initSentry();

  // OSS runtime: run Postgres schema migrations to ensure all 31 tables exist
  // in the causeflow schema (AC-040).
  if (config.isOss()) {
    const { runPgMigrations } = await import('./shared/infra/db/pg-client.js');
    await runPgMigrations();
  }

  // Ensure DynamoDB table exists (dev/LocalStack only) — skipped in the OSS
  // local runtime where Postgres replaces DynamoDB (AC-039/AC-040). Calling
  // DescribeTable here would contact the AWS endpoint, which the OSS boot path
  // must never do.
  if (config.isDev() && !config.isOss()) {
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

  // Seed dev tenants (idempotent — skips if already exist). Skipped in the OSS
  // runtime: seeding writes through DynamoDB repositories which would contact
  // AWS at boot. OSS dev seeding arrives with the Postgres repositories (AC-040).
  if (config.isDev() && !config.isOss()) {
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
    // DLQ redrive job — redrive messages from DLQs back to source queues.
    // Runs every 30 seconds so a manually pushed message is redriven within
    // one tick (AC-037). Only active when DLQ URLs are configured.
    {
      name: 'dlq-redrive',
      intervalMs: 30_000,
      execute: async () => {
        const pairs = [
          { dlq: config.sqs.alertDlqUrl, target: config.sqs.alertQueueUrl, name: 'alerts' },
          {
            dlq: config.sqs.investigationDlqUrl,
            target: config.sqs.investigationQueueUrl,
            name: 'investigation',
          },
          {
            dlq: config.sqs.remediationDlqUrl,
            target: config.sqs.remediationQueueUrl,
            name: 'remediation',
          },
        ];
        for (const pair of pairs) {
          if (pair.dlq && pair.target) {
            try {
              const result = await redriveDLQ(pair.dlq, pair.target, 5);
              if (result.moved > 0 || result.failed > 0) {
                logger.info(
                  { queue: pair.name, moved: result.moved, failed: result.failed },
                  'DLQ redrive completed',
                );
              }
            } catch (err) {
              logger.error({ err, queue: pair.name }, 'DLQ redrive failed');
            }
          }
        }
      },
    },
    // Cost rollup job — aggregates UsageRecordEntity into per-tenant daily
    // totals and writes a UsageRecordEntity tagged type=daily_rollup (AC-037).
    // Runs every hour. Scans tenants and rolls up records for the previous day.
    {
      name: 'cost-rollup',
      intervalMs: 60 * 60 * 1000, // 1 hour
      execute: async () => {
        try {
          const now = new Date();
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const dayStart = new Date(
            Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()),
          );
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
          const dayLabel = dayStart.toISOString().slice(0, 10);

          // Fetch all tenants (scan) — limited in dev with few tenants
          const tenantScan = await TenantEntity.scan.go({ limit: 100 });
          const tenants = tenantScan.data;

          for (const tenant of tenants) {
            const tenantId = tenant.tenantId;
            // Query usage records for this tenant (all types except existing rollups)
            const usageScan = await UsageRecordEntity.query
              .byType({ tenantId, type: 'investigation' })
              .go();
            const eventScan = await UsageRecordEntity.query
              .byType({ tenantId, type: 'event' })
              .go();
            const records = [...usageScan.data, ...eventScan.data];

            // Filter records within yesterday
            const dayRecords = records.filter((r) => {
              const created = new Date(r.createdAt);
              return created >= dayStart && created < dayEnd;
            });

            if (dayRecords.length === 0) continue;

            // Aggregate
            const totalCostUsd = dayRecords.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);

            // Check if a daily_rollup already exists for this tenant+day
            const existingRollup = await UsageRecordEntity.query
              .byType({ tenantId, type: 'daily_rollup' })
              .go();
            const alreadyRolledUp = existingRollup.data.some((r) =>
              r.createdAt.startsWith(dayLabel),
            );
            if (alreadyRolledUp) continue;

            // Write the daily_rollup record
            const allBreakdowns = dayRecords.flatMap((r) => r.agentBreakdown ?? []);
            await UsageRecordEntity.create({
              tenantId,
              recordId: `daily_rollup_${tenantId}_${dayLabel}`,
              type: 'daily_rollup' as const,
              costUsd: totalCostUsd,
              ...(allBreakdowns.length > 0 && { agentBreakdown: allBreakdowns }),
              createdAt: dayStart.toISOString(),
            }).go();

            logger.info(
              { tenantId, day: dayLabel, totalCostUsd, recordCount: dayRecords.length },
              'Cost rollup written',
            );
          }
        } catch (err) {
          logger.error({ err }, 'Cost rollup job failed');
        }
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
    shutdown: () => {
      ctx.sseManager.shutdown();
      return Promise.resolve();
    },
  });

  // Finally close Redis (used by rate limiter etc.)
  lifecycle.register({
    name: 'redis',
    shutdown: closeRedis,
  });

  // Close the dedicated BullMQ Redis connection (AC-041). Only initialised
  // in the OSS runtime but safe to close regardless.
  lifecycle.register({
    name: 'bullmq-redis',
    shutdown: async () => {
      const { closeBullRedis } = await import('./shared/infra/queue/bull-mq-connection.js');
      await closeBullRedis();
    },
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

    // AC-041: Log the 4 BullMQ queues at startup.
    // In the OSS runtime, these are backed by the shared Redis connection.
    // In the AWS runtime, the queue names are informational (SQS is used).
    const queueNames = [
      config.bullmq.alertQueueName,
      config.bullmq.triageQueueName,
      config.bullmq.investigationQueueName,
      config.bullmq.remediationQueueName,
    ];
    const workerCounts = config.isOss() ? 'worker=1' : 'worker=0 (SQS)'; // In OSS mode each queue has 1 worker; in AWS mode workers are separate processes.
    logger.info(
      {
        queues: queueNames.map((name) => `${name} (${workerCounts})`),
        transport: config.isOss() ? 'bullmq-on-redis' : 'sqs',
      },
      `BullMQ queues: ${queueNames.join(', ')} — ${workerCounts}`,
    );
  });

  // Attach WebSocket server for relay connections
  if (relayRegistry && config.relay.enabled) {
    const registry = relayRegistry;
    createRelayWSServer(server as HttpServer, registry, config.relay.wsPath);
    logger.info({ wsPath: config.relay.wsPath }, 'Relay WSS server attached');

    lifecycle.register({
      name: 'relay-registry',
      shutdown: () => {
        registry.shutdown();
        return Promise.resolve();
      },
    });
  }

  // Attach Investigation relay WebSocket server
  const investigationRelay = new InvestigationRelayRegistry();
  // Wire on-demand followup dispatch — relay server triggers this when a dashboard
  // sends guidance but no worker is currently connected for the session.
  if (config.ecs.cluster) {
    investigationRelay.setDispatcher(async (tid, iid) => {
      const { dispatchInvestigation } =
        await import('./shared/infra/investigation/ecs-task-dispatcher.js');
      await dispatchInvestigation({
        incidentId: iid,
        tenantId: tid,
        suggestedAgents: [],
        mode: 'followup',
      });
    });
  } else if (config.isOss()) {
    investigationRelay.setDispatcher(async (tid, iid) => {
      const { dispatchInvestigation } =
        await import('./shared/infra/investigation/local-task-dispatcher.js');
      await dispatchInvestigation({
        incidentId: iid,
        tenantId: tid,
        suggestedAgents: [],
        mode: 'followup',
      });
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
    shutdown: () => {
      investigationRelay.shutdown();
      return Promise.resolve();
    },
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
