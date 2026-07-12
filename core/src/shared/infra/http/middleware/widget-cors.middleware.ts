import { createHash } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../hono-types.js';
import type { IApiKeyRepository } from '../../../../modules/tenant/domain/api-key.repository.js';
import type { ITenantRepository } from '../../../../modules/tenant/domain/tenant.repository.js';
import { tenantId } from '../../../domain/value-objects.js';

interface CacheEntry {
  origins: string[];
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Dynamic per-tenant CORS middleware for widget endpoints.
 * Reads allowedOrigins from tenant's widgetConfig.
 * Caches lookups in memory with 5-minute TTL.
 */
export function widgetCorsMiddleware(
  apiKeyRepo: IApiKeyRepository,
  tenantRepo: ITenantRepository,
): MiddlewareHandler<AppEnv> {
  const originCache = new Map<string, CacheEntry>();

  return async (c, next) => {
    const origin = c.req.header('Origin');

    // No origin or null origin = server-to-server / local file, allow
    if (!origin || origin === 'null') {
      c.header('Access-Control-Allow-Origin', '*');
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      c.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-API-Key, X-Widget-Agent-Id, X-Widget-Agent-Name, X-Request-Id',
      );
      c.header(
        'Access-Control-Expose-Headers',
        'X-RateLimit-Limit, X-RateLimit-Remaining, X-Request-Id',
      );
      c.header('Access-Control-Max-Age', '600');
      c.header('Vary', 'Origin');
      if (c.req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: Object.fromEntries(c.res.headers) });
      }
      return next();
    }

    const apiKey = extractApiKey(c);
    if (!apiKey) {
      return next();
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const allowedOrigins = await resolveAllowedOrigins(
      keyHash,
      apiKeyRepo,
      tenantRepo,
      originCache,
    );

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      c.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-API-Key, X-Widget-Agent-Id, X-Widget-Agent-Name, X-Request-Id',
      );
      c.header(
        'Access-Control-Expose-Headers',
        'X-RateLimit-Limit, X-RateLimit-Remaining, X-Request-Id',
      );
      c.header('Access-Control-Max-Age', '600');
      c.header('Vary', 'Origin');
    }

    // Handle preflight
    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: Object.fromEntries(c.res.headers) });
    }

    return next();
  };
}

async function resolveAllowedOrigins(
  keyHash: string,
  apiKeyRepo: IApiKeyRepository,
  tenantRepo: ITenantRepository,
  cache: Map<string, CacheEntry>,
): Promise<string[]> {
  const cached = cache.get(keyHash);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.origins;
  }

  const key = await apiKeyRepo.findByHash(keyHash);
  if (!key || key.status !== 'active') {
    return [];
  }

  const tenant = await tenantRepo.findById(tenantId(key.tenantId));
  const origins = tenant?.settings?.widgetConfig?.allowedOrigins ?? [];

  cache.set(keyHash, { origins, cachedAt: Date.now() });
  return origins;
}

function extractApiKey(c: {
  req: { header: (name: string) => string | undefined };
}): string | undefined {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return c.req.header('X-API-Key');
}
