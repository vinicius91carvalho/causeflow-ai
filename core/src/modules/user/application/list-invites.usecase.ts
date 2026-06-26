import type { IInviteRepository } from '../domain/invite.repository.js';
import type { Invite } from '../domain/invite.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export class ListInvitesUseCase {
    inviteRepo;
    constructor(inviteRepo: IInviteRepository) {
        this.inviteRepo = inviteRepo;
    }
    async execute(tenantId: TenantId): Promise<Invite[]> {
        const all = await this.inviteRepo.findByTenant(tenantId);
        // Filter to pending only, excluding expired
        const now = new Date();
        return all.filter((invite) => invite.status === 'pending' && new Date(invite.expiresAt) > now);
    }
}
