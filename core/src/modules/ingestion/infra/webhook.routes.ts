import { Hono } from 'hono';
import { webhookAuth } from '../../../shared/infra/http/middleware/webhook-auth.middleware.js';
import { createSentryWebhookAuth } from '../../integration/infra/middleware/sentry-webhook-auth.middleware.js';
import { config } from '../../../shared/config/index.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import type { IngestAlertUseCase } from '../application/ingest-alert.usecase.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ReserveInvestigationUseCase } from '../../billing/application/reserve-investigation.usecase.js';
import type { IApiKeyRepository } from '../../tenant/domain/api-key.repository.js';
import type { ISentryIntegrationRepository } from '../../integration/domain/sentry-integration.repository.js';

export interface WebhookUseCases {
  ingestAlert: IngestAlertUseCase;
  reserveInvestigation?: ReserveInvestigationUseCase;
  apiKeyRepo?: IApiKeyRepository;
  sentryIntegrationRepo?: ISentryIntegrationRepository;
}

function extractExternalId(provider: string, payload: Record<string, any>) {
  switch (provider) {
    case 'datadog':
      return payload['id'] ?? payload['alert_id'] ?? '';
    case 'grafana':
      return payload['ruleId'] ?? String(payload['ruleId'] ?? '');
    case 'cloudwatch':
      return payload['AlarmName'] ?? '';
    case 'sentry':
      return String(payload['data']?.['issue']?.['id'] ?? '');
    default:
      return payload['id'] ?? '';
  }
}
export function createWebhookRoutes(
  useCases: WebhookUseCases,
): Hono<AppEnv, import('hono/types').BlankSchema, '/'> {
  const app = new Hono<AppEnv>();

  // AD-1: Sentry route uses its own HMAC middleware, NOT the generic webhookAuth.
  // Generic webhookAuth (X-Webhook-Signature + X-API-Key) is applied to all non-sentry routes only.
  //
  // Trust model: the Sentry path is matched FIRST and gated by sentryAuth (HMAC over the
  // raw body using a per-tenant Client Secret). Sentry payloads NEVER pass through
  // webhookAuth — that middleware would reject them anyway (no X-API-Key), but route
  // ordering here guarantees the request body is only parsed AFTER HMAC verification.
  if (useCases.sentryIntegrationRepo) {
    const sentryAuth = createSentryWebhookAuth(useCases.sentryIntegrationRepo);
    app.post('/:tenantId/sentry', sentryAuth, async (c) => {
      const tid = tenantId(c.req.param('tenantId'));
      const payload = await c.req.json();
      // Record the event arrival regardless of ingestion outcome
      await useCases.sentryIntegrationRepo!.markEventReceived(String(tid));
      // Lazily mark verified on first successful authenticated hit
      await useCases.sentryIntegrationRepo!.markVerified(String(tid));
      // Reserve investigation credit — skipped in OSS runtime (AC-043)
      if (useCases.reserveInvestigation && !config.isOss()) {
        const reservation = await useCases.reserveInvestigation.execute(tid);
        if (!reservation.reserved) {
          return c.json({ error: 'QUOTA_EXCEEDED', message: 'Investigation limit reached' }, 402);
        }
      }
      const externalId = extractExternalId('sentry', payload);
      const incident = await useCases.ingestAlert.execute(tid, {
        source: 'sentry',
        externalId,
        payload,
      });
      return c.json(
        {
          status: 'accepted',
          incidentId: incident.incidentId,
          provider: 'sentry',
          externalId,
          receivedAt: new Date().toISOString(),
        },
        202,
      );
    });
  }

  // All non-sentry routes use generic webhookAuth (X-Webhook-Signature + X-API-Key)
  app.use('/*', webhookAuth(config.webhook.secret, useCases.apiKeyRepo));
  app.post('/:tenantId/:provider', async (c) => {
    const tid = tenantId(c.req.param('tenantId'));
    const provider = c.req.param('provider');
    const payload = await c.req.json();
    // Reserve investigation credit — skipped in OSS runtime (AC-043)
    if (useCases.reserveInvestigation && !config.isOss()) {
      const reservation = await useCases.reserveInvestigation.execute(tid);
      if (!reservation.reserved) {
        return c.json({ error: 'QUOTA_EXCEEDED', message: 'Investigation limit reached' }, 402);
      }
    }
    const externalId = extractExternalId(provider, payload);
    const rawAlert = {
      source: provider,
      externalId,
      payload,
    };
    const incident = await useCases.ingestAlert.execute(tid, rawAlert);
    return c.json(
      {
        status: 'accepted',
        incidentId: incident.incidentId,
        provider,
        externalId,
        receivedAt: new Date().toISOString(),
      },
      202,
    );
  });
  return app;
}
