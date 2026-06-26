import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/domain/errors.js';
import type { IInviteRepository } from '../domain/invite.repository.js';
import type { IUserRepository } from '../domain/user.repository.js';
import type { User } from '../domain/user.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface AcceptInviteInput {
    tenantId: TenantId;
    email: string;
}

export class AcceptInviteUseCase {
    inviteRepo;
    userRepo;
    eventBus;
    constructor(inviteRepo: IInviteRepository, userRepo: IUserRepository, eventBus: IEventBus) {
        this.inviteRepo = inviteRepo;
        this.userRepo = userRepo;
        this.eventBus = eventBus;
    }
    async execute(input: AcceptInviteInput): Promise<User> {
        const invite = await this.inviteRepo.findByEmail(input.tenantId, input.email);
        if (!invite) {
            throw new NotFoundError('Invite', input.email);
        }
        if (invite.status !== 'pending') {
            throw new ValidationError(`Invite is not pending, current status: ${invite.status}`);
        }
        const isExpired = new Date(invite.expiresAt) < new Date();
        if (isExpired) {
            throw new ValidationError('Invite has expired');
        }
        // Check if user already exists in this tenant
        const existingUser = await this.userRepo.findByEmail(input.email);
        if (existingUser && existingUser.tenantId === input.tenantId) {
            throw new ConflictError(`User already exists in this tenant: ${input.email}`);
        }
        const now = new Date().toISOString();
        const user = {
            tenantId: input.tenantId,
            userId: uuidv4(),
            email: input.email,
            name: input.email.split('@')[0] ?? input.email,
            role: invite.role,
            profileComplete: false,
            createdAt: now,
            updatedAt: now,
        };
        const created = await this.userRepo.create(user);
        // Mark invite as accepted
        await this.inviteRepo.update(input.tenantId, input.email, {
            status: 'accepted',
        });
        await this.eventBus.publish({
            eventType: 'invite.accepted',
            occurredAt: now,
            tenantId: input.tenantId,
            payload: { email: input.email, userId: created.userId, role: created.role },
        });
        return created;
    }
}
