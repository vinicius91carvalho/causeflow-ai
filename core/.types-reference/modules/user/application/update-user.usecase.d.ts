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
export declare class UpdateUserUseCase {
    private readonly userRepo;
    private readonly eventBus;
    constructor(userRepo: IUserRepository, eventBus: IEventBus);
    execute(input: UpdateUserInput): Promise<User>;
}
