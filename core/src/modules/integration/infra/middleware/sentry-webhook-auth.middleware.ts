import { createMiddleware } from 'hono/factory';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../../../shared/config/index.js';
import { UnauthorizedError } from '../../../../shared/domain/errors.js';
import type { AppEnv } from '../../../../shared/infra/http/hono-types.js';
import type { ISentryIntegrationRepository } from '../../domain/sentry-integration.repository.js';

/**
 * Sentry-specific webhook HMAC verification middleware.
 *
 * Sentry Internal Integrations sign every webhook with:
 *   Sentry-Hook-Signature: <hex SHA256 HMAC of raw body>
 *
 * Differences from the generic webhookAuth middleware:
 * - Header: `Sentry-Hook-Signature` (not `X-Webhook-Signature`)
 * - No `sha256=` prefix stripping — Sentry sends raw hex
 * - No global secret — secret is per-tenant, stored encrypted in the integration row
 * - No X-API-Key lookup — tenant is identified from the URL `:tenantId` param
 *
 * Per AD-1: this middleware is ONLY mounted at `/v1/webhooks/:tenantId/sentry`.
 * The generic `webhookAuth` MUST NOT be applied to the Sentry route.
 */
export function createSentryWebhookAuth(
  sentryRepo: Pick<ISentryIntegrationRepository, 'findSentryClientSecret'>,
): ReturnType<typeof createMiddleware<AppEnv>> {
  return createMiddleware<AppEnv>(async (c, next) => {
    // Read raw body BEFORE any JSON parsing — body parsing happens only after verification
    const rawBody = await c.req.text();

    // First: try per-tenant Sentry integration auth (Sentry-Hook-Signature)
    const sentrySignature = c.req.header('Sentry-Hook-Signature');
    if (sentrySignature) {
      const tenantIdParam = c.req.param('tenantId') ?? '';
      const clientSecret = await sentryRepo.findSentryClientSecret(tenantIdParam);

      if (clientSecret) {
        const expected = createHmac('sha256', clientSecret).update(rawBody).digest('hex');
        let valid = false;
        try {
          const sigBuffer = Buffer.from(sentrySignature, 'hex');
          const expectedBuffer = Buffer.from(expected, 'hex');
          valid =
            sigBuffer.length === expectedBuffer.length &&
            timingSafeEqual(sigBuffer, expectedBuffer);
        } catch {
          valid = false;
        }
        if (valid) {
          return next();
        }
      }
    }

    // Dev-mode fallback: try the generic X-Webhook-Signature with the global
    // webhook secret (only in non-production environments).
    if (!config.isProd()) {
      const genericSig = c.req.header('X-Webhook-Signature');
      if (genericSig) {
        const sig = genericSig.replace('sha256=', '');
        const genericExpected = createHmac('sha256', config.webhook.secret)
          .update(rawBody)
          .digest('hex');
        let valid = false;
        try {
          const sigBuffer = Buffer.from(sig, 'hex');
          const expectedBuffer = Buffer.from(genericExpected, 'hex');
          valid =
            sigBuffer.length === expectedBuffer.length &&
            timingSafeEqual(sigBuffer, expectedBuffer);
        } catch {
          valid = false;
        }
        if (valid) {
          return next();
        }
      }
    }

    throw new UnauthorizedError('Webhook authentication failed');
  });
}
