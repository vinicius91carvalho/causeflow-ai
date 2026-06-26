import { NotFoundError, ForbiddenError } from '../../../shared/domain/errors.js';
import type { IUserRepository } from '../domain/user.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface DeleteUserInput {
    tenantId: TenantId;
    userId: string;
    actorUserId: string;
}

export class DeleteUserUseCase {
    userRepo;
    eventBus;
    constructor(userRepo: IUserRepository, eventBus: IEventBus) {
        this.userRepo = userRepo;
        this.eventBus = eventBus;
    }
    async execute(input: DeleteUserInput): Promise<void> {
        // Cannot delete self
        if (input.actorUserId === input.userId) {
            throw new ForbiddenError('Cannot delete your own account');
        }
        const existing = await this.userRepo.findById(input.tenantId, input.userId);
        if (!existing) {
            throw new NotFoundError('User', input.userId);
        }
        await this.userRepo.delete(input.tenantId, input.userId);
        await this.eventBus.publish({
            eventType: 'user.deleted',
            occurredAt: new Date().toISOString(),
            tenantId: input.tenantId,
            payload: { userId: input.userId, email: existing.email },
        });
    }
}
