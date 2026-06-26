import type { IInviteRepository } from '../domain/invite.repository.js';
import type { IUserRepository } from '../domain/user.repository.js';
import type { User } from '../domain/user.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface AcceptInviteInput {
    tenantId: TenantId;
    email: string;
}
export declare class AcceptInviteUseCase {
    private readonly inviteRepo;
    private readonly userRepo;
    private readonly eventBus;
    constructor(inviteRepo: IInviteRepository, userRepo: IUserRepository, eventBus: IEventBus);
    execute(input: AcceptInviteInput): Promise<User>;
}
