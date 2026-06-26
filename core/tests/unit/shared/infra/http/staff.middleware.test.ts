import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireStaff, isStaffEmail } from '../../../../../src/shared/infra/http/middleware/staff.middleware.js';
import { ForbiddenError } from '../../../../../src/shared/domain/errors.js';
import type { AppEnv } from '../../../../../src/shared/infra/http/hono-types.js';

describe('isStaffEmail', () => {
    it('accepts any email at causeflow.ai', () => {
        expect(isStaffEmail('sergio@causeflow.ai')).toBe(true);
        expect(isStaffEmail('ops+test@causeflow.ai')).toBe(true);
    });

    it('matches case-insensitively', () => {
        expect(isStaffEmail('Sergio@CauseFlow.AI')).toBe(true);
    });

    it('rejects other domains', () => {
        expect(isStaffEmail('sergio@example.com')).toBe(false);
        expect(isStaffEmail('sergio@fake-causeflow.ai.evil.com')).toBe(false);
    });

    it('rejects empty/undefined', () => {
        expect(isStaffEmail(undefined)).toBe(false);
        expect(isStaffEmail('')).toBe(false);
    });
});

describe('requireStaff middleware', () => {
    function buildApp(email: string | undefined) {
        const app = new Hono<AppEnv>();
        app.use('*', async (c, next) => {
            if (email !== undefined) c.set('userEmail', email);
            await next();
        });
        app.get('/protected', requireStaff, (c) => c.json({ ok: true }));
        app.onError((err, c) => {
            if (err instanceof ForbiddenError) return c.json({ error: err.message }, 403);
            return c.json({ error: 'boom' }, 500);
        });
        return app;
    }

    it('allows requests from @causeflow.ai users', async () => {
        const res = await buildApp('sergio@causeflow.ai').request('/protected');
        expect(res.status).toBe(200);
    });

    it('rejects users from other domains with 403', async () => {
        const res = await buildApp('tenant-admin@acme.com').request('/protected');
        expect(res.status).toBe(403);
    });

    it('rejects requests with no authenticated email', async () => {
        const res = await buildApp(undefined).request('/protected');
        expect(res.status).toBe(403);
    });
});
