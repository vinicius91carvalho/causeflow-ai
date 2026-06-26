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
export declare function webhookAuth(globalSecret: string, apiKeyRepo?: IApiKeyRepository): import("hono").MiddlewareHandler<AppEnv, string, {}, Response>;
