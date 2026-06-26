import type { AppEnv } from '../hono-types.js';
/**
 * Tenant guard: validates that the tenantId from JWT is present.
 * TenantId is now extracted from JWT in authMiddleware — this middleware
 * only ensures authenticated routes have a valid tenant context.
 *
 * For webhook routes (public), tenantId comes from the URL path param.
 */
export declare const tenantMiddleware: import("hono").MiddlewareHandler<AppEnv, string, {}, Response>;
