import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { CreateUserUseCase } from '../application/create-user.usecase.js';
import type { ListUsersUseCase } from '../application/list-users.usecase.js';
import type { UpdateUserUseCase } from '../application/update-user.usecase.js';
import type { DeleteUserUseCase } from '../application/delete-user.usecase.js';
import type { CreateInviteUseCase } from '../application/create-invite.usecase.js';
import type { ListInvitesUseCase } from '../application/list-invites.usecase.js';
import type { RevokeInviteUseCase } from '../application/revoke-invite.usecase.js';
import type { GetSettingsUseCase } from '../application/get-settings.usecase.js';
import type { UpdateSettingsUseCase } from '../application/update-settings.usecase.js';
import type { GetUserByEmailUseCase } from '../application/get-user-by-email.usecase.js';
import type { AcceptInviteUseCase } from '../application/accept-invite.usecase.js';

export interface UserUseCases {
  createUser: CreateUserUseCase;
  listUsers: ListUsersUseCase;
  updateUser: UpdateUserUseCase;
  deleteUser: DeleteUserUseCase;
  createInvite: CreateInviteUseCase;
  listInvites: ListInvitesUseCase;
  revokeInvite: RevokeInviteUseCase;
  getSettings: GetSettingsUseCase;
  updateSettings: UpdateSettingsUseCase;
  getUserByEmail?: GetUserByEmailUseCase;
  acceptInvite?: AcceptInviteUseCase;
}

const createUserSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
});
const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
  profileComplete: z.boolean().optional(),
  termsAcceptedAt: z.string().optional(),
});
const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  locale: z.enum(['en', 'pt-br']).optional(),
  notifications: z
    .object({
      emailOnComplete: z.boolean().optional(),
      emailOnError: z.boolean().optional(),
      slackOnComplete: z.boolean().optional(),
      slackOnError: z.boolean().optional(),
    })
    .optional(),
  name: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
});
const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
});
export function createUserRoutes(useCases: UserUseCases) {
  const users = new Hono<AppEnv>();
  const invites = new Hono<AppEnv>();
  // GET /v1/users — list team members (any role)
  users.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const result = await useCases.listUsers.execute(tenantId);
    return c.json({ items: result });
  });
  // POST /v1/users — create user (admin only)
  users.post('/', requireRole('admin'), zValidator('json', createUserSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const body = c.req.valid('json');
    const user = await useCases.createUser.execute({
      tenantId,
      userId: body.userId,
      email: body.email,
      name: body.name,
      role: body.role,
    });
    return c.json(user, 201);
  });
  // PATCH /v1/users/:userId — update name/role (admin only)
  users.patch('/:userId', requireRole('admin'), zValidator('json', updateUserSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const actorUserId = c.get('userId');
    const userId = c.req.param('userId');
    const body = c.req.valid('json');
    const user = await useCases.updateUser.execute({
      tenantId,
      userId,
      actorUserId,
      ...body,
    });
    return c.json(user);
  });
  // DELETE /v1/users/:userId — remove member (admin only, not self)
  users.delete('/:userId', requireRole('admin'), async (c) => {
    const tenantId = c.get('tenantId');
    const actorUserId = c.get('userId');
    const userId = c.req.param('userId');
    await useCases.deleteUser.execute({ tenantId, userId, actorUserId });
    return c.json({ message: 'User deleted' });
  });
  // GET /v1/users/:userId/settings — get user settings + profile + company
  users.get('/:userId/settings', async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.req.param('userId');
    const result = await useCases.getSettings.execute(tenantId, userId);
    return c.json(result);
  });
  // PATCH /v1/users/:userId/settings — update user settings
  users.patch('/:userId/settings', zValidator('json', updateSettingsSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.req.param('userId');
    const body = c.req.valid('json');
    const result = await useCases.updateSettings.execute({
      tenantId,
      userId,
      ...body,
    });
    return c.json(result);
  });
  // GET /v1/users/by-email/:email — find user by email (for Auth.js OAuth linking)
  if (useCases.getUserByEmail) {
    users.get('/by-email/:email', async (c) => {
      const email = decodeURIComponent(c.req.param('email'));
      const user = await useCases.getUserByEmail!.execute(email);
      if (!user) {
        return c.json({ user: null });
      }
      return c.json({ user });
    });
  }
  // GET /v1/users/:userId/profile — get user profile (cross-tenant, for Auth.js OAuth linking)
  users.get('/:userId/profile', async (c) => {
    const userId = c.req.param('userId');
    const tid = c.get('tenantId');
    const result = await useCases.getSettings.execute(tid, userId);
    return c.json(result);
  });
  // POST /v1/invites/:email/accept — accept an invite
  if (useCases.acceptInvite) {
    invites.post('/:email/accept', async (c) => {
      const tid = c.get('tenantId');
      const email = decodeURIComponent(c.req.param('email'));
      const user = await useCases.acceptInvite!.execute({ tenantId: tid, email });
      return c.json(user, 201);
    });
  }
  // GET /v1/invites — list pending invites (any role)
  invites.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const result = await useCases.listInvites.execute(tenantId);
    return c.json({ items: result });
  });
  // POST /v1/invites — create invite (admin only)
  invites.post('/', requireRole('admin'), zValidator('json', createInviteSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const actorEmail = c.get('userEmail');
    const body = c.req.valid('json');
    const invite = await useCases.createInvite.execute({
      tenantId,
      email: body.email,
      invitedBy: actorEmail ?? 'unknown',
      role: body.role,
    });
    return c.json(invite, 201);
  });
  // DELETE /v1/invites/:email — revoke invite (admin only)
  invites.delete('/:email', requireRole('admin'), async (c) => {
    const tenantId = c.get('tenantId');
    const email = decodeURIComponent(c.req.param('email'));
    await useCases.revokeInvite.execute({ tenantId, email });
    return c.json({ message: 'Invite revoked' });
  });
  return { users, invites };
}
