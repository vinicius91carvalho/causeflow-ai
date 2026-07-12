import { SignJWT } from 'jose';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import { config } from '../../../shared/config/index.js';
import { UnauthorizedError } from '../../../shared/domain/errors.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import type { HandleClerkWebhookUseCase } from '../application/handle-clerk-webhook.usecase.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';

export interface AuthUseCases {
  handleClerkWebhook: HandleClerkWebhookUseCase;
  tenantRepo?: ITenantRepository;
}

function createLocalJwt(payload: Record<string, unknown>): Promise<string> {
  const secret = new TextEncoder().encode(config.auth.jwtSecret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(config.auth.jwtIssuer)
    .setAudience(config.auth.jwtAudience)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
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

  // OSS login — issues a local JWT for a valid tenant (no Clerk).
  // Used in the open-source local runtime where Clerk is not configured.
  app.post(
    '/oss-login',
    zValidator(
      'json',
      z.object({
        tenantId: z.string().min(1),
        email: z.string().email().optional(),
      }),
    ),
    async (c) => {
      const { tenantId: rawTid, email } = c.req.valid('json');
      const tid = tenantId(rawTid);

      // Verify tenant exists when a tenant repo is available
      if (useCases.tenantRepo) {
        const tenant = await useCases.tenantRepo.findById(tid);
        if (!tenant) {
          throw new UnauthorizedError('Invalid tenant');
        }
      }

      const token = await createLocalJwt({
        sub: email ?? 'oss-user',
        email,
        tenantId: tid,
        org_id: tid,
        org_role: 'admin',
      });

      // Set tenantId in context for downstream middleware
      c.set('tenantId', tenantId(tid));
      c.set('userId', email ?? 'oss-user');
      c.set('userEmail', email ?? '');
      c.set('userRoles', ['admin']);

      return c.json({ token });
    },
  );

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
