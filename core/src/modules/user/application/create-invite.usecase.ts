import { ConflictError } from '../../../shared/domain/errors.js';
import type { IInviteRepository } from '../domain/invite.repository.js';
import type { Invite } from '../domain/invite.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import { getClerkClient } from '../../auth/infra/clerk-client.js';
import { logger } from '../../../shared/infra/logger.js';

export interface CreateInviteInput {
  tenantId: TenantId;
  email: string;
  invitedBy: string;
  role?: 'owner' | 'admin' | 'member' | 'viewer';
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export class CreateInviteUseCase {
  inviteRepo;
  eventBus;
  constructor(inviteRepo: IInviteRepository, eventBus: IEventBus) {
    this.inviteRepo = inviteRepo;
    this.eventBus = eventBus;
  }
  async execute(input: CreateInviteInput): Promise<Invite> {
    // Check for duplicate pending invite (not expired and not revoked)
    const existing = await this.inviteRepo.findByEmail(input.tenantId, input.email);
    if (existing && existing.status === 'pending') {
      const isExpired = new Date(existing.expiresAt) < new Date();
      if (!isExpired) {
        throw new ConflictError(`An active invite already exists for ${input.email}`);
      }
    }
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    const invite = {
      tenantId: input.tenantId,
      email: input.email,
      invitedBy: input.invitedBy,
      role: input.role ?? 'member',
      status: 'pending',
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    // If an old invite exists (expired/revoked/accepted), overwrite it
    if (existing) {
      const updated = await this.inviteRepo.update(input.tenantId, input.email, {
        invitedBy: invite.invitedBy,
        role: invite.role,
        status: 'pending',
        expiresAt,
      });
      await this.eventBus.publish({
        eventType: 'invite.created',
        occurredAt: now,
        tenantId: input.tenantId,
        payload: { email: input.email, invitedBy: input.invitedBy, role: invite.role },
      });
      await this.sendClerkInvitation(input);
      return updated;
    }
    const created = await this.inviteRepo.create(invite as Invite);
    await this.eventBus.publish({
      eventType: 'invite.created',
      occurredAt: now,
      tenantId: input.tenantId,
      payload: { email: input.email, invitedBy: input.invitedBy, role: created.role },
    });
    await this.sendClerkInvitation(input);
    return created;
  }

  private async sendClerkInvitation(input: CreateInviteInput): Promise<void> {
    try {
      const clerk = getClerkClient();
      const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'https://dashboard.causeflow.ai';
      await clerk.organizations.createOrganizationInvitation({
        organizationId: input.tenantId as string,
        emailAddress: input.email,
        role: input.role === 'admin' ? 'org:admin' : 'org:member',
        inviterUserId: input.invitedBy,
        redirectUrl: `${dashboardUrl}/accept-invitation`,
      });
    } catch (err) {
      logger.warn({ err, email: input.email }, 'Failed to create Clerk invitation');
    }
  }
}
