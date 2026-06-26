import type { IUserRepository } from '../domain/user.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface DeleteUserInput {
    tenantId: TenantId;
    userId: string;
    actorUserId: string;
}
export declare class DeleteUserUseCase {
    private readonly userRepo;
    private readonly eventBus;
    constructor(userRepo: IUserRepository, eventBus: IEventBus);
    execute(input: DeleteUserInput): Promise<void>;
}
