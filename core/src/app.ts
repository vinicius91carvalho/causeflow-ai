import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { config } from './shared/config/index.js';
import { errorHandler } from './shared/infra/http/middleware/error-handler.js';
import { authMiddleware } from './shared/infra/http/middleware/auth.middleware.js';
import { tenantMiddleware } from './shared/infra/http/middleware/tenant.middleware.js';
import { rateLimitMiddleware } from './shared/infra/http/middleware/rate-limit.middleware.js';
import { auditMiddleware } from './shared/infra/http/middleware/audit.middleware.js';
import { requestLoggerMiddleware } from './shared/infra/http/middleware/request-logger.middleware.js';
import { otelLangfuseBridge } from './shared/infra/http/middleware/otel-langfuse-bridge.middleware.js';
import { createTenantRoutes } from './modules/tenant/infra/tenant.routes.js';
import { createAuditRoutes } from './modules/audit/infra/audit.routes.js';
import { createWebhookRoutes } from './modules/ingestion/infra/webhook.routes.js';
import { createIncidentRoutes } from './modules/ingestion/infra/incident.routes.js';
import { createTriageRoutes } from './modules/triage/infra/triage.routes.js';
import { createInvestigationRoutes } from './modules/investigation/infra/investigation.routes.js';
import { createRemediationRoutes } from './modules/remediation/infra/remediation.routes.js';
import { createNotificationRoutes } from './modules/notification/infra/notification.routes.js';
import { createAnalyticsRoutes } from './modules/ingestion/infra/analytics.routes.js';
import { createApiKeyRoutes } from './modules/tenant/infra/api-key.routes.js';
import { createAdminRoutes } from './modules/ingestion/infra/admin.routes.js';
import { createAdminQueueRoutes } from './shared/infra/queue/bull-admin.js';
import { createComposioWebhookRoute, createTriggerRoutes } from './modules/integration/infra/trigger.routes.js';
import { createIntegrationRoutes } from './modules/integration/infra/integration.routes.js';
import { createRelayRoutes } from './modules/integration/infra/relay.routes.js';
import { createAuthRoutes } from './modules/auth/infra/auth.routes.js';
import { createCodeKnowledgeRoutes } from './modules/code-intelligence/infra/code-knowledge.routes.js';
import { createMemoryRoutes } from './modules/memory/infra/memory.routes.js';
import { createWidgetRoutes } from './modules/widget/infra/widget.routes.js';
import { createPortalRoutes } from './modules/widget/infra/portal.routes.js';
import { createBillingRoutes, createBillingWebhookRoute, createSignupRoute } from './modules/billing/infra/billing.routes.js';
import { createUserRoutes } from './modules/user/infra/user.routes.js';
import { createOssLlmConnectorRoutes } from './modules/oss/infra/oss-llm-connector.routes.js';
import type { AppContext } from './bootstrap.js';
import type { AppEnv } from './shared/infra/http/hono-types.js';
import type { BlankSchema } from 'hono/types';
import type { HealthCheckResult } from './shared/infra/health/health-checker.js';
export function createApp(ctx: AppContext): Hono<AppEnv, BlankSchema, "/"> {
    const app = new Hono<AppEnv>();
    // Global middleware (order matters: auth → tenant guard → rate limit → audit)
    app.onError(errorHandler);
    app.use('*', cors({
        origin: (origin) => {
            // Allow requests with no origin or null origin (server-to-server, local files, about:blank)
            if (!origin || origin === 'null')
                return '*';
            return ctx.corsOrigins.includes(origin) ? origin : null;
        },
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
        exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Request-Id'],
        maxAge: 600,
    }));
    app.use('*', requestId());
    app.use('*', otelLangfuseBridge());
    app.use('*', authMiddleware);
    app.use('*', tenantMiddleware);
    app.use('*', rateLimitMiddleware);
    app.use('*', auditMiddleware);
    app.use('*', requestLoggerMiddleware);
    // Dashboard
    app.get('/dashboard', (c) => {
        const html = readFileSync(resolve('dashboard/index.html'), 'utf-8');
        return c.html(html);
    });
    // Widget bundle — Vite-built embeddable widget served at /widget/widget.js (public, no auth)
    app.get('/widget/widget.js', (c) => {
        try {
            const bundle = readFileSync(resolve('packages/widget/dist/widget.js'), 'utf-8');
            return c.body(bundle, 200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        } catch {
            return c.text('Widget bundle not built. Run `pnpm --filter @causeflow/widget build`.', 404);
        }
    });
    // Health checks
    // Response shape (Sprint 3 / I5): { status, service, version, commit, timestamp }
    //   - version → semver from package.json (stable, app-level)
    //   - commit  → 7-char git SHA baked at image build time via Dockerfile ARG GIT_SHA
    //
    // In the open-source local runtime (AC-039 / AC-054) the body is instead a flat map
    //   of check name → status, e.g. {postgres:"ok",redis:"ok",llm:"ok",anthropic:"ok",queues:"ok"}
    //   (anthropic is "skipped" when no API key is set; llm reports Ornith reachability).
    // The AWS control plane keeps the I5 metadata shape so verify-deploy's `commit` assertion holds.
    app.get('/health', async (c) => {
        const result = await ctx.healthChecker.runAll();
        const httpStatus = result.status === 'down' ? 503 : 200;
        if (config.isOss()) {
            const checks: Record<string, string> = {};
            for (const check of result.checks ?? []) {
                checks[check.name] = check.status;
            }
            return c.json(checks, httpStatus);
        }
        // Per-service health map (e.g. { dynamodb: 'ok', redis: 'ok', sqs: 'ok', anthropic: 'ok' }).
        // Anthropic reports 'ok' (skipped) when no API key is configured.
        const checks = Object.fromEntries(
            (result.checks ?? []).map((check: HealthCheckResult) => [check.name, check.status]),
        );
        return c.json({
            status: result.status,
            service: 'causeflow',
            version: '0.1.0',
            commit: process.env['APP_VERSION'] ?? 'unknown',
            timestamp: result.timestamp,
            checks,
        }, httpStatus);
    });
    // Detailed health — protected (requires auth)
    app.get('/health/detailed', async (c) => {
        const tenantId = c.get('tenantId');
        if (!tenantId) {
            return c.json({ error: 'Authentication required' }, 401);
        }
        const result = await ctx.healthChecker.runAll();
        const httpStatus = result.status === 'down' ? 503 : 200;
        return c.json({
            status: result.status,
            timestamp: result.timestamp,
            checks: (result.checks ?? []).map((check: HealthCheckResult) => ({
                name: check.name,
                status: check.status,
                latencyMs: check.latencyMs,
            })),
        }, httpStatus);
    });
    // Admin queue visibility — BullMQ queue stats for the open-source local runtime (AC-041).
    // This is a local-only admin endpoint that reports queue depth, completed/failed counts,
    // and the last 5 jobs. It is mounted regardless of runtime so devs can check queues even
    // in AWS mode if they have Redis access.
    app.route('/admin', createAdminQueueRoutes());

    // Module routes
    app.route('/v1/tenants', createTenantRoutes(ctx.tenantUseCases));
    app.route('/v1/audit', createAuditRoutes(ctx.auditUseCases));
    app.route('/v1/webhooks', createWebhookRoutes(ctx.webhookUseCases));
    app.route('/v1/incidents', createIncidentRoutes(ctx.incidentUseCases));
    app.route('/v1/triage', createTriageRoutes(ctx.triageUseCases));
    app.route('/v1/investigation', createInvestigationRoutes(ctx.investigationUseCases));
    app.route('/api/v1/investigation', createInvestigationRoutes(ctx.investigationUseCases));
    app.route('/v1/remediation', createRemediationRoutes(ctx.remediationUseCases));
    app.route('/api/v1/remediation', createRemediationRoutes(ctx.remediationUseCases));
    app.route('/v1/notifications', createNotificationRoutes(ctx.notificationUseCases));
    app.route('/v1/analytics', createAnalyticsRoutes(ctx.analyticsUseCases));
    app.route('/v1/api-keys', createApiKeyRoutes(ctx.apiKeyUseCases));
    app.route('/v1/admin', createAdminRoutes(ctx.adminDeps));
    app.route('/v1/code-knowledge', createCodeKnowledgeRoutes(ctx.codeKnowledgeUseCases));
    app.route('/v1/memory', createMemoryRoutes(ctx.memoryUseCases));
    // User + Team management routes
    const { users: userRoutes, invites: inviteRoutes } = createUserRoutes(ctx.userUseCases);
    app.route('/v1/users', userRoutes);
    app.route('/v1/invites', inviteRoutes);
    // Billing routes (authenticated endpoints + optional webhook + optional signup)
    // In the OSS runtime (AC-043), Stripe-dependent routes (webhook, signup) are
    // not mounted. The billing routes themselves handle OSS mode internally by
    // returning 410 Gone for disabled features and stub data for subscription/usage.
    app.route('/v1/billing', createBillingRoutes(ctx.billingUseCases));
    if (!config.isOss()) {
      app.route('/v1/billing', createBillingWebhookRoute(ctx.billingUseCases));
      app.route('/v1/signup', createSignupRoute(ctx.billingUseCases));
    }
    // Integration routes (credential-based + unified list)
    app.route('/v1/integrations', createIntegrationRoutes(ctx.integrationUseCases));
    // Auth routes
    if (config.isOss() && 'ossAuthRouter' in ctx) {
      const ossAuthRouter = (ctx as any).ossAuthRouter;
      app.route('/v1/auth', ossAuthRouter);
      app.route('/v1/oss/llm-connector', createOssLlmConnectorRoutes());
    } else {
      app.route('/v1/auth', createAuthRoutes(ctx.authUseCases));
    }
    // Whoami — returns authenticated principal (user + tenant) from the
    // middleware context. Works with both Clerk JWTs and tenant API keys
    // (cflo_…), letting programmatic callers resolve their identity.
    app.get('/v1/whoami', (c) => {
        const roles = c.get('userRoles') ?? [];
        return c.json({
            user: { id: c.get('userId'), email: c.get('userEmail') },
            tenantId: c.get('tenantId'),
            role: roles[0] ?? null,
            roles,
        });
    });
    // Skills routes (tenant-specific investigation skills)
    if (ctx.skillRoutes) {
        app.route('/', ctx.skillRoutes);
    }
    // Beta allowlist (public — email check)
    if (ctx.betaAllowlistRoutes) {
        app.route('/v1/beta-allowlist', ctx.betaAllowlistRoutes);
    }
    // Relay integration routes
    if (ctx.relayGateway) {
        app.route('/v1/relay', createRelayRoutes(ctx.relayGateway));
    }
    // Composio trigger routes
    if (ctx.composioWebhookDeps) {
        app.route('/webhooks', createComposioWebhookRoute(ctx.composioWebhookDeps));
    }
    if (ctx.triggerUseCases) {
        app.route('/v1/triggers', createTriggerRoutes(ctx.triggerUseCases));
    }
    // Widget routes (API key auth — separate from JWT auth)
    if (ctx.widgetUseCases) {
        app.route('/v1/widget', createWidgetRoutes(ctx.widgetUseCases));
        app.route('/portal', createPortalRoutes({
            tenantRepo: ctx.widgetUseCases.tenantRepo,
            apiKeyRepo: ctx.widgetUseCases.apiKeyRepo,
        }));
    }
    return app;
}
