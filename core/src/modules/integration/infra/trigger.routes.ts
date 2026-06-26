import { Hono } from 'hono';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import { integrationId, tenantId, triggerId } from '../../../shared/domain/value-objects.js';
import { IntegrationEntity } from '../../../shared/infra/db/entities/IntegrationEntity.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { HandleComposioWebhookUseCase } from '../application/handle-composio-webhook.usecase.js';
import type { CreateTriggerUseCase } from '../application/create-trigger.usecase.js';
import type { ListTriggersUseCase } from '../application/list-triggers.usecase.js';
import type { DeleteTriggerUseCase } from '../application/delete-trigger.usecase.js';
import type { ComposioTriggerService } from '../../../shared/infra/integrations/composio-trigger-service.js';
import { TriggerAlreadyExistsError } from '../domain/trigger.errors.js';
import { config } from '../../../shared/config/index.js';

// Providers that receive events via CauseFlow's direct webhook, not Composio triggers
const WEBHOOK_ONLY_PROVIDERS = new Set(['sentry', 'pagerduty', 'datadog']);

export interface ComposioWebhookDeps {
    handleComposioWebhook: HandleComposioWebhookUseCase;
}

export interface TriggerUseCases {
    createTrigger: CreateTriggerUseCase;
    listTriggers: ListTriggersUseCase;
    deleteTrigger: DeleteTriggerUseCase;
    composioTriggerService: ComposioTriggerService;
}

export function createComposioWebhookRoute(deps: ComposioWebhookDeps): Hono<AppEnv> {
    const app = new Hono<AppEnv>();
    // POST /composio — Composio trigger webhook receiver
    app.post('/composio', async (c) => {
        const rawBody = await c.req.text();
        const signatureHeader = c.req.header('webhook-signature') ?? '';
        const result = await deps.handleComposioWebhook.execute({
            rawBody,
            signatureHeader,
        });
        if (!result.processed) {
            return c.json({ received: true, action: result.action }, 200);
        }
        return c.json({ received: true, action: result.action });
    });
    return app;
}
export function createTriggerRoutes(useCases: TriggerUseCases): Hono<AppEnv> {
    const app = new Hono<AppEnv>();
    // GET / — List triggers for tenant
    app.get('/', async (c) => {
        const tid = c.get('tenantId');
        if (!tid)
            return c.json({ error: 'Tenant context required' }, 401);
        const triggers = await useCases.listTriggers.execute(tenantId(tid));
        return c.json({ triggers });
    });
    // POST / — Create a new trigger (admin only)
    app.post('/', requireRole('admin'), async (c) => {
        const tid = c.get('tenantId');
        if (!tid)
            return c.json({ error: 'Tenant context required' }, 401);
        const body = await c.req.json();
        if (!body.triggerSlug || !body.provider) {
            return c.json({ error: 'triggerSlug and provider are required' }, 400);
        }
        const isWebhookOnly = WEBHOOK_ONLY_PROVIDERS.has(body.provider);
        let connectedAccountId = '';
        if (!isWebhookOnly) {
            // Look up the Composio connectedAccountId stored during OAuth finalization
            const intId = integrationId(`${body.provider}-composio`);
            const integration = await IntegrationEntity.get({ tenantId: tid, integrationId: intId }).go();
            connectedAccountId = integration.data?.config?.apiKeyRef ?? '';
            if (!connectedAccountId) {
                return c.json({ error: `${body.provider} is not connected via OAuth. Please connect it first.` }, 400);
            }
        }
        try {
            const trigger = await useCases.createTrigger.execute({
                tenantId: tenantId(tid),
                triggerSlug: body.triggerSlug,
                provider: body.provider,
                config: body.config ?? {},
                connectedAccountId,
            });
            // For webhook-only providers, include the URL to configure in the external service
            const webhookUrl = isWebhookOnly
                ? `${config.apiUrl}/v1/webhooks/${tid}/${body.provider}`
                : undefined;
            return c.json({ trigger, ...(webhookUrl ? { webhookUrl } : {}) }, 201);
        } catch (err) {
            if (err instanceof TriggerAlreadyExistsError) {
                return c.json({ error: 'TRIGGER_ALREADY_EXISTS', message: err.message }, 409);
            }
            throw err;
        }
    });
    // GET /available — List available trigger types per provider (from Composio)
    // MUST be registered before /:id to prevent route shadowing
    app.get('/available', async (c) => {
        const triggers = await useCases.composioTriggerService.listAvailableTriggers();
        return c.json({ triggers });
    });
    // DELETE /:id — Delete a trigger (admin only)
    app.delete('/:id', requireRole('admin'), async (c) => {
        const tid = c.get('tenantId');
        if (!tid)
            return c.json({ error: 'Tenant context required' }, 401);
        const trgId = c.req.param('id');
        await useCases.deleteTrigger.execute(tenantId(tid), triggerId(trgId));
        return c.json({ deleted: true });
    });
    return app;
}
