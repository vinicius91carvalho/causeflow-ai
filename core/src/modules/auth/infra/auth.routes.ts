import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { HandleClerkWebhookUseCase } from '../application/handle-clerk-webhook.usecase.js';

export interface AuthUseCases {
    handleClerkWebhook: HandleClerkWebhookUseCase;
}

export function createAuthRoutes(useCases: AuthUseCases) {
    const app = new Hono<AppEnv>();

    // Clerk webhook (public — verified via Svix signature)
    app.post('/clerk-webhook', async (c) => {
        const svixId = c.req.header('svix-id');
        const svixTimestamp = c.req.header('svix-timestamp');
        const svixSignature = c.req.header('svix-signature');

        if (!svixId || !svixTimestamp || !svixSignature) {
            return c.json({ error: 'Missing required Svix headers' }, 400);
        }

        const body = await c.req.text();
        try {
            await useCases.handleClerkWebhook.execute(body, {
                'svix-id': svixId,
                'svix-timestamp': svixTimestamp,
                'svix-signature': svixSignature,
            });
            return c.json({ received: true });
        } catch (err: unknown) {
            const name = (err as { name?: string })?.name;
            if (name === 'WebhookVerificationError') {
                return c.json({ error: 'Invalid webhook signature' }, 401);
            }
            throw err;
        }
    });

    // Login — verifies the Clerk session JWT via authMiddleware (which runs on
    // all non-public paths) and returns the user, tenant and role extracted by
    // the middleware. A call without a Bearer token is rejected 401 by the
    // auth middleware before reaching this handler.
    app.post('/login', (c) => {
        const roles = c.get('userRoles') ?? [];
        return c.json({
            user: { id: c.get('userId'), email: c.get('userEmail') },
            tenant: c.get('tenantId'),
            role: roles[0] ?? null,
            roles,
        });
    });

    // Whoami — returns authenticated user info from middleware context
    app.get('/me', (c) => {
        return c.json({
            tenantId: c.get('tenantId'),
            userId: c.get('userId'),
            email: c.get('userEmail'),
            roles: c.get('userRoles'),
        });
    });

    return app;
}
