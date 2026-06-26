import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import type { CreateTenantUseCase } from '../application/create-tenant.usecase.js';
import type { GetTenantUseCase } from '../application/get-tenant.usecase.js';
import type { UpdateTenantUseCase } from '../application/update-tenant.usecase.js';
import type { ListTenantsUseCase } from '../application/list-tenants.usecase.js';

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  ownerEmail: z.string().email(),
  plan: z.enum(['starter', 'pro', 'business', 'enterprise']).optional(),
  settings: z
    .object({
      maxIncidentsPerMonth: z.number().int().positive().optional(),
      autoRemediation: z.boolean().optional(),
      notificationChannels: z.array(z.string()).optional(),
    })
    .optional(),
});

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  ownerEmail: z.string().email().optional(),
  plan: z.enum(['starter', 'pro', 'business', 'enterprise']).optional(),
  status: z.enum(['active', 'suspended', 'trial', 'cancelled']).optional(),
  settings: z
    .object({
      maxIncidentsPerMonth: z.number().int().positive().optional(),
      autoRemediation: z.boolean().optional(),
      notificationChannels: z.array(z.string()).optional(),
      chatProvider: z.enum(['web_portal', 'slack', 'teams']).optional(),
    })
    .optional(),
});

export interface TenantUseCases {
  createTenant: CreateTenantUseCase;
  getTenant: GetTenantUseCase;
  updateTenant: UpdateTenantUseCase;
  listTenants: ListTenantsUseCase;
}

export function createTenantRoutes(useCases: TenantUseCases) {
  const app = new Hono<AppEnv>();

  app.post('/', requireRole('admin'), zValidator('json', createTenantSchema), async (c) => {
    const input = c.req.valid('json');
    // Use Clerk org ID as tenantId when available (from JWT o.id claim)
    const orgTenantId = c.get('tenantId');
    const actorUserId = c.get('userId');
    const actorEmail = c.get('userEmail');
    const tenant = await useCases.createTenant.execute({ ...input, actorUserId, actorEmail }, orgTenantId);
    return c.json(tenant, 201);
  });

  app.get('/', async (c) => {
    const ownerEmail = c.get('userEmail');
    const limit = Number(c.req.query('limit') ?? '20');
    const cursor = c.req.query('cursor');
    const result = await useCases.listTenants.execute({ ownerEmail, limit, cursor });
    return c.json(result);
  });

  app.get('/:tenantId', async (c) => {
    const id = tenantId(c.req.param('tenantId'));
    const tenant = await useCases.getTenant.execute(id);
    return c.json(tenant);
  });

  app.patch('/:tenantId', requireRole('admin'), zValidator('json', updateTenantSchema), async (c) => {
    const id = tenantId(c.req.param('tenantId'));
    const input = c.req.valid('json');
    const actorUserId = c.get('userId');
    const actorEmail = c.get('userEmail');
    const tenant = await useCases.updateTenant.execute(id, { ...input, actorUserId, actorEmail });
    return c.json(tenant);
  });

  return app;
}
