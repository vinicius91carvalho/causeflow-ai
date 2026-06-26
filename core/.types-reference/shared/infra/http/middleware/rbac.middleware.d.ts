import type { AppEnv } from '../hono-types.js';
/**
 * Role-based access control middleware factory.
 * Returns a middleware that checks if the authenticated user
 * has at least one of the required roles in their JWT claims.
 *
 * Usage: app.use('/admin/*', requireRole('admin', 'owner'))
 */
export declare function requireRole(...roles: string[]): import("hono").MiddlewareHandler<AppEnv, string, {}, Response>;
