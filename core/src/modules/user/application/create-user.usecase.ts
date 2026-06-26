import { ConflictError } from '../../../shared/domain/errors.js';
import type { IUserRepository } from '../domain/user.repository.js';
import type { User, UserRole } from '../domain/user.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface CreateUserInput {
    tenantId: TenantId;
    userId: string;
    email: string;
    name: string;
    role?: UserRole;
}

export class CreateUserUseCase {
    userRepo;
    eventBus;
    constructor(userRepo: IUserRepository, eventBus: IEventBus) {
        this.userRepo = userRepo;
        this.eventBus = eventBus;
    }
    async execute(input: CreateUserInput): Promise<User> {
        // Check if user already exists in this tenant
        const existing = await this.userRepo.findById(input.tenantId, input.userId);
        if (existing) {
            throw new ConflictError(`User already exists in this tenant: ${input.userId}`);
        }
        const now = new Date().toISOString();
        const user = {
            tenantId: input.tenantId,
            userId: input.userId,
            email: input.email,
            name: input.name,
            role: input.role ?? 'member',
            profileComplete: false,
            createdAt: now,
            updatedAt: now,
        };
        const created = await this.userRepo.create(user);
        await this.eventBus.publish({
            eventType: 'user.created',
            occurredAt: now,
            tenantId: created.tenantId,
            payload: { userId: created.userId, email: created.email, role: created.role },
        });
        return created;
    }
}
