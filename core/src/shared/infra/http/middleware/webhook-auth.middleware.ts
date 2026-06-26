import { createMiddleware } from 'hono/factory';
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { UnauthorizedError } from '../../../domain/errors.js';
import type { AppEnv } from '../hono-types.js';
import type { IApiKeyRepository } from '../../../../modules/tenant/domain/api-key.repository.js';
/**
 * Webhook HMAC signature verification middleware factory.
 * Verifies X-Webhook-Signature header using HMAC-SHA256.
 *
 * Supports per-API-key webhook secrets:
 * - If X-API-Key header is present and apiKeyRepo is provided, uses the key's webhookSecretHash
 * - Falls back to global secret
 *
 * Usage: app.use('/v1/webhooks/*', webhookAuth('my-secret', apiKeyRepo))
 */
export function webhookAuth(globalSecret: string, apiKeyRepo?: IApiKeyRepository): import("hono").MiddlewareHandler<AppEnv, string, {}, Response> {
    return createMiddleware(async (c, next) => {
        const signature = c.req.header('X-Webhook-Signature');
        if (!signature) {
            throw new UnauthorizedError('Missing X-Webhook-Signature header');
        }
        const body = await c.req.text();
        const sig = signature.replace('sha256=', '');
        // Try per-API-key webhook secret first
        const apiKeyHeader = c.req.header('X-API-Key');
        if (apiKeyHeader && apiKeyRepo) {
            const keyHash = createHash('sha256').update(apiKeyHeader).digest('hex');
            const apiKey = await apiKeyRepo.findByHash(keyHash);
            if (apiKey?.status === 'active' && apiKey.webhookSecretHash) {
                // Reconstruct the secret from the hash isn't possible,
                // but the caller signed with the plaintext secret.
                // We need to verify: HMAC(body, plaintextSecret) == signature
                // Since we only store the hash of the secret, we can't compute HMAC directly.
                // Instead, the API key's webhookSecretHash IS used as the HMAC key.
                // The caller must use the webhookSecret (returned once at creation) as HMAC key.
                const expected = createHmac('sha256', apiKey.webhookSecretHash).update(body).digest('hex');
                const sigBuffer = Buffer.from(sig, 'hex');
                const expectedBuffer = Buffer.from(expected, 'hex');
                if (sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer)) {
                    return next();
                }
                // If per-key verification fails, don't fallback — it's an explicit per-key attempt
                throw new UnauthorizedError('Invalid webhook signature');
            }
        }
        // Fallback to global secret
        const expected = createHmac('sha256', globalSecret).update(body).digest('hex');
        const sigBuffer = Buffer.from(sig, 'hex');
        const expectedBuffer = Buffer.from(expected, 'hex');
        if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
            throw new UnauthorizedError('Invalid webhook signature');
        }
        return next();
    });
}
