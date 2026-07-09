/**
 * OSS local auth routes (register + login) for the open-source runtime.
 *
 * Replaces Clerk for the OSS runtime (AC-042):
 * - POST /v1/auth/register — creates tenant + owner user, returns JWT
 * - POST /v1/auth/login — validates credentials, returns JWT
 */
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { SignJWT } from 'jose';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ITenantRepository } from '../../../modules/tenant/domain/tenant.repository.js';
import type { IUserRepository } from '../../../modules/user/domain/user.repository.js';

export interface OssAuthDeps {
    tenantRepo: ITenantRepository;
    userRepo: IUserRepository;
}

// In-memory password store for OSS mode (ephemeral, lost on restart).
// In production, the password hash would be stored in the user's data JSONB.
const passwordStore = new Map<string, { hash: string; salt: string }>();

function hashPassword(password: string): { hash: string; salt: string } {
    const salt = randomUUID().slice(0, 16);
    const hash = scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
}

function verifyPassword(password: string, stored: { hash: string; salt: string }): boolean {
    const hash = scryptSync(password, stored.salt, 64).toString('hex');
    try {
        return timingSafeEqual(Buffer.from(hash), Buffer.from(stored.hash));
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
        const tenantId = randomUUID();
        const slug = body.tenantName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const now = new Date().toISOString();

        const tenant = await deps.tenantRepo.create({
            tenantId: tenantId as unknown as Parameters<typeof deps.tenantRepo.create>[0]['tenantId'],
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

        // Store password hash (in-memory for OSS dev mode)
        const pwHash = hashPassword(body.password);
        passwordStore.set(userId, pwHash);

        // Generate JWT
        const secret = new TextEncoder().encode(
            (process.env['JWT_SECRET'] ?? 'oss-dev-jwt-secret-change-me'),
        );
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

        return c.json({
            user: { id: userId, email: body.email, name: body.name },
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

        const stored = passwordStore.get(user.userId);
        if (!stored || !verifyPassword(body.password, stored)) {
            return c.json({ error: 'Invalid email or password' }, 401);
        }

        // Generate JWT
        const secret = new TextEncoder().encode(
            (process.env['JWT_SECRET'] ?? 'oss-dev-jwt-secret-change-me'),
        );
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

    return app;
}
