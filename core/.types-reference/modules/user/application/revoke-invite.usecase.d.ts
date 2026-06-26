import type { IInviteRepository } from '../domain/invite.repository.js';
import type { Invite } from '../domain/invite.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface RevokeInviteInput {
    tenantId: TenantId;
    email: string;
}
export declare class RevokeInviteUseCase {
    private readonly inviteRepo;
    private readonly eventBus;
    constructor(inviteRepo: IInviteRepository, eventBus: IEventBus);
    execute(input: RevokeInviteInput): Promise<Invite>;
}
