import type { IInviteRepository } from '../domain/invite.repository.js';
import type { Invite } from '../domain/invite.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface CreateInviteInput {
    tenantId: TenantId;
    email: string;
    invitedBy: string;
    role?: 'admin' | 'member';
}
export declare class CreateInviteUseCase {
    private readonly inviteRepo;
    private readonly eventBus;
    constructor(inviteRepo: IInviteRepository, eventBus: IEventBus);
    execute(input: CreateInviteInput): Promise<Invite>;
}
