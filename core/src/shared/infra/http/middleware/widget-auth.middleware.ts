import { createHash } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { UnauthorizedError } from '../../../domain/errors.js';
import { tenantId } from '../../../domain/value-objects.js';
import type { AppEnv } from '../hono-types.js';
import type { IApiKeyRepository } from '../../../../modules/tenant/domain/api-key.repository.js';

/**
 * Widget authentication middleware.
 * Validates tenant API keys (cflo_ prefix) for widget endpoints.
 * Sets tenantId and optional agent identity on context.
 */
export function widgetAuthMiddleware(
    apiKeyRepo: IApiKeyRepository,
): MiddlewareHandler<AppEnv> {
    return async (c, next) => {
        const apiKey = extractApiKey(c);
        if (!apiKey) {
            throw new UnauthorizedError('Missing API key. Provide via Authorization: Bearer cflo_... or X-API-Key header.');
        }

        if (!apiKey.startsWith('cflo_')) {
            throw new UnauthorizedError('Invalid API key format');
        }

        const keyHash = createHash('sha256').update(apiKey).digest('hex');
        const key = await apiKeyRepo.findByHash(keyHash);

        if (!key || key.status !== 'active') {
            throw new UnauthorizedError('Invalid or revoked API key');
        }

        c.set('tenantId', tenantId(key.tenantId));
        c.set('widgetAuth', true);
        c.set('userId', '');
        c.set('userEmail', '');
        c.set('userRoles', ['widget']);

        const agentId = c.req.header('X-Widget-Agent-Id');
        const agentName = c.req.header('X-Widget-Agent-Name');
        if (agentId) c.set('widgetAgentId', agentId);
        if (agentName) c.set('widgetAgentName', agentName);

        // Update lastUsedAt (fire-and-forget)
        apiKeyRepo.findById(key.tenantId, key.keyId).catch(() => {});

        return next();
    };
}

function extractApiKey(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return c.req.header('X-API-Key');
}
