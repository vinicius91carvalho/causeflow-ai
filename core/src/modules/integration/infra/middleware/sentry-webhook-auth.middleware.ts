import { createMiddleware } from 'hono/factory';
import { createHmac, timingSafeEqual } from 'node:crypto';
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
        const signature = c.req.header('Sentry-Hook-Signature');
        if (!signature) {
            throw new UnauthorizedError('Missing Sentry-Hook-Signature header');
        }

        // Read raw body BEFORE any JSON parsing — body parsing happens only after verification
        const rawBody = await c.req.text();

        // Look up the tenant's decrypted Client Secret from the integration row
        const tenantIdParam = c.req.param('tenantId') ?? '';
        const clientSecret = await sentryRepo.findSentryClientSecret(tenantIdParam);

        if (!clientSecret) {
            // No integration configured for this tenant — treat as 401 (don't leak 404)
            throw new UnauthorizedError('No Sentry integration configured for this tenant');
        }

        // Compute expected HMAC-SHA256 (hex, no prefix)
        const expected = createHmac('sha256', clientSecret).update(rawBody).digest('hex');

        // Constant-time comparison to prevent timing attacks
        let valid = false;
        try {
            const sigBuffer = Buffer.from(signature, 'hex');
            const expectedBuffer = Buffer.from(expected, 'hex');
            valid = sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);
        } catch {
            // Buffer.from('non-hex') can throw — treat as invalid
            valid = false;
        }

        if (!valid) {
            throw new UnauthorizedError('Invalid Sentry-Hook-Signature');
        }

        // Stash the already-read raw body so downstream handlers can re-parse as JSON
        // Hono caches req.text() so calling c.req.json() after this still works.
        return next();
    });
}
