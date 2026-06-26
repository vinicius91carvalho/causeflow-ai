import { createMiddleware } from 'hono/factory';
import { ForbiddenError } from '../../../domain/errors.js';
import type { AppEnv } from '../hono-types.js';
/**
 * Role-based access control middleware factory.
 * Returns a middleware that checks if the authenticated user
 * has at least one of the required roles in their JWT claims.
 *
 * Usage: app.use('/admin/*', requireRole('admin'))
 */
export function requireRole(...roles: string[]): import("hono").MiddlewareHandler<AppEnv, string, {}, Response> {
    return createMiddleware(async (c, next) => {
        const userRoles = c.get('userRoles') ?? [];
        const hasRole = roles.some((r) => userRoles.includes(r));
        if (!hasRole) {
            throw new ForbiddenError(`Insufficient permissions. Required: ${roles.join(' | ')}`);
        }
        return next();
    });
}
