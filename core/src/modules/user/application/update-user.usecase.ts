import { NotFoundError, ForbiddenError } from '../../../shared/domain/errors.js';
import type { IUserRepository } from '../domain/user.repository.js';
import type { User, UserRole } from '../domain/user.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface UpdateUserInput {
    tenantId: TenantId;
    userId: string;
    actorUserId: string;
    name?: string;
    role?: UserRole;
    profileComplete?: boolean;
    termsAcceptedAt?: string;
}

export class UpdateUserUseCase {
    userRepo;
    eventBus;
    constructor(userRepo: IUserRepository, eventBus: IEventBus) {
        this.userRepo = userRepo;
        this.eventBus = eventBus;
    }
    async execute(input: UpdateUserInput): Promise<User> {
        const existing = await this.userRepo.findById(input.tenantId, input.userId);
        if (!existing) {
            throw new NotFoundError('User', input.userId);
        }
        // Self-demotion protection: cannot change own role
        if (input.role && input.actorUserId === input.userId) {
            throw new ForbiddenError('Cannot change your own role');
        }
        const changes: Partial<Pick<User, 'name' | 'role' | 'profileComplete' | 'termsAcceptedAt'>> = {};
        if (input.name !== undefined)
            changes.name = input.name;
        if (input.role !== undefined)
            changes.role = input.role;
        if (input.profileComplete !== undefined)
            changes.profileComplete = input.profileComplete;
        if (input.termsAcceptedAt !== undefined)
            changes.termsAcceptedAt = input.termsAcceptedAt;
        const updated = await this.userRepo.update(input.tenantId, input.userId, changes);
        await this.eventBus.publish({
            eventType: 'user.updated',
            occurredAt: new Date().toISOString(),
            tenantId: input.tenantId,
            payload: { userId: input.userId, changes },
        });
        return updated;
    }
}
