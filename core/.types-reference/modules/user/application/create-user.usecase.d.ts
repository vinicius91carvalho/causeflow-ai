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
export declare class CreateUserUseCase {
    private readonly userRepo;
    private readonly eventBus;
    constructor(userRepo: IUserRepository, eventBus: IEventBus);
    execute(input: CreateUserInput): Promise<User>;
}
