import type { IInviteRepository } from '../domain/invite.repository.js';
import type { Invite } from '../domain/invite.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class ListInvitesUseCase {
    private readonly inviteRepo;
    constructor(inviteRepo: IInviteRepository);
    execute(tenantId: TenantId): Promise<Invite[]>;
}
