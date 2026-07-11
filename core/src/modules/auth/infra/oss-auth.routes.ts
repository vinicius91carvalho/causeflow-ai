/**
 * OSS local auth routes (register + login) for the open-source runtime.
 *
 * Replaces Clerk for the OSS runtime (AC-042):
 * - POST /v1/auth/register — creates tenant + owner user, returns JWT
 * - POST /v1/auth/login — validates credentials, returns JWT
 *
 * Password hashes are stored in the user's JSONB data column (Postgres),
 * keyed as "passwordHash" (format: "salt:hash"). Only accessible in
 * the OSS runtime; the AWS/Clerk runtime never reads this field.
 */
import { Hono } from 'hono';
import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { SignJWT } from 'jose';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ITenantRepository } from '../../../modules/tenant/domain/tenant.repository.js';
import type { IUserRepository } from '../../../modules/user/domain/user.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import { config } from '../../../shared/config/index.js';
import { pgGet, pgUpdate } from '../../../shared/infra/db/postgres/pg-utils.js';

export interface OssAuthDeps {
    tenantRepo: ITenantRepository;
    userRepo: IUserRepository;
    eventBus: IEventBus;
}

function hashPassword(password: string): string {
    const salt = randomUUID().slice(0, 16);
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
    const idx = stored.indexOf(':');
    if (idx === -1) return false;
    const salt = stored.slice(0, idx);
    const hash = stored.slice(idx + 1);
    if (!salt || !hash) return false;
    const computed = scryptSync(password, salt, 64).toString('hex');
    try {
        return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
    } catch {
        return false;
    }
}

export function createOssAuthRoutes(deps: OssAuthDeps) {
    const app = new Hono<AppEnv>();

    // POST /v1/auth/register — create tenant + user, return JWT
    app.post('/register', async (c) => {
        const body = await c.req.json<{
            email: string;
            password: string;
            tenantName: string;
            name?: string;
        }>();

        if (!body.email || !body.password || !body.tenantName) {
            return c.json({ error: 'email, password, and tenantName are required' }, 400);
        }

        if (body.password.length < 6) {
            return c.json({ error: 'Password must be at least 6 characters' }, 400);
        }

        // Check if email already registered
        const existingUser = await deps.userRepo.findByEmail(body.email);
        if (existingUser) {
            return c.json({ error: 'Email already registered' }, 409);
        }

        // Create tenant
        const tidRaw = randomUUID();
        const slug = body.tenantName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const now = new Date().toISOString();

        const tenant = await deps.tenantRepo.create({
            tenantId: tenantId(tidRaw),
            name: body.tenantName,
            slug,
            ownerEmail: body.email,
            plan: 'free' as const,
            status: 'active' as const,
            settings: {
                maxIncidentsPerMonth: 100,
                autoRemediation: false,
                notificationChannels: [],
            },
            createdAt: now,
            updatedAt: now,
        });

        // Fire tenant.created so configureHindsightBankSubscriber creates the bank (AC-052).
        try {
            await deps.eventBus.publish({
                eventType: 'tenant.created',
                occurredAt: now,
                tenantId: tenant.tenantId,
                payload: { tenantId: String(tenant.tenantId), slug, plan: tenant.plan, name: tenant.name },
            });
        } catch {
            // Non-critical — Hindsight bank is created lazily on first retain
        }

        // Create user
        const userId = randomUUID();
        const user = await deps.userRepo.create({
            tenantId: tenant.tenantId,
            userId,
            email: body.email,
            name: (body.name ?? body.email.split('@')[0]) as string,
            role: 'admin' as const,
            profileComplete: true,
            createdAt: now,
            updatedAt: now,
        });

        // Persist password hash in the user's JSONB data (Postgres)
        const pwHashStr = hashPassword(body.password);
        await pgUpdate('users', String(tenant.tenantId), userId, { passwordHash: pwHashStr });

        // Generate JWT
        const secret = new TextEncoder().encode(config.auth.jwtSecret);
        const token = await new SignJWT({
            sub: userId,
            email: body.email,
            tenant_id: String(tenant.tenantId),
            roles: ['admin'],
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .setIssuer('causeflow')
            .setAudience('causeflow-api')
            .sign(secret);

        const displayName = body.name ?? body.email.split('@')[0] ?? '';
        return c.json({
            user: { id: userId, email: body.email, name: displayName },
            tenant: { id: String(tenant.tenantId), name: tenant.name, slug: tenant.slug },
            token,
        }, 201);
    });

    // POST /v1/auth/login — authenticate, return JWT
    app.post('/login', async (c) => {
        const body = await c.req.json<{ email: string; password: string }>();

        if (!body.email || !body.password) {
            return c.json({ error: 'email and password are required' }, 400);
        }

        const user = await deps.userRepo.findByEmail(body.email);
        if (!user) {
            return c.json({ error: 'Invalid email or password' }, 401);
        }

        // Retrieve password hash from the user's JSONB data (Postgres)
        const row = await pgGet('users', String(user.tenantId), user.userId);
        if (!row) {
            return c.json({ error: 'Invalid email or password' }, 401);
        }
        const storedHash = row.data?.['passwordHash'] as string | undefined;
        if (!storedHash || !verifyPassword(body.password, storedHash)) {
            return c.json({ error: 'Invalid email or password' }, 401);
        }

        // Generate JWT
        const secret = new TextEncoder().encode(config.auth.jwtSecret);
        const token = await new SignJWT({
            sub: user.userId,
            email: user.email,
            tenant_id: String(user.tenantId),
            roles: [user.role],
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .setIssuer('causeflow')
            .setAudience('causeflow-api')
            .sign(secret);

        return c.json({
            user: { id: user.userId, email: user.email, name: user.name, role: user.role },
            tenant: { id: String(user.tenantId) },
            token,
        });
    });

    // GET /v1/auth/whoami — returns authenticated user + tenant info
    // Also accessible at the global /v1/whoami (defined in app.ts).
    // This endpoint is provided for convenience in the OSS auth context.
    app.get('/whoami', (c) => {
        const roles = c.get('userRoles') ?? [];
        return c.json({
            user: { id: c.get('userId'), email: c.get('userEmail') },
            tenantId: c.get('tenantId'),
            role: roles[0] ?? null,
            roles,
        });
    });

    return app;
}
