import { createMiddleware } from 'hono/factory';
import { ForbiddenError } from '../../../domain/errors.js';
import type { AppEnv } from '../hono-types.js';

/**
 * Gate for CauseFlow staff-only endpoints (e.g. switching investigation
 * modes per-investigation). Matches any email whose domain is on the
 * internal allow-list (causeflow.ai + sister brand simuser.ai).
 *
 * Intentionally stricter than `requireRole('admin')` — admins exist inside
 * tenant orgs, but staff controls internal experiments and must never leak
 * to tenant operators.
 */
const STAFF_EMAIL_DOMAINS = ['@causeflow.ai', '@simuser.ai'] as const;

export function isStaffEmail(email: string | undefined): boolean {
    if (!email) return false;
    const lower = email.toLowerCase();
    return STAFF_EMAIL_DOMAINS.some((domain) => lower.endsWith(domain));
}

export const requireStaff = createMiddleware<AppEnv>(async (c, next) => {
    const email = c.get('userEmail');
    if (!isStaffEmail(email)) {
        throw new ForbiddenError('Staff access required');
    }
    return next();
});
