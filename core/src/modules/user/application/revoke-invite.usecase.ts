import { NotFoundError } from '../../../shared/domain/errors.js';
import type { IInviteRepository } from '../domain/invite.repository.js';
import type { Invite } from '../domain/invite.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface RevokeInviteInput {
    tenantId: TenantId;
    email: string;
}

export class RevokeInviteUseCase {
    inviteRepo;
    eventBus;
    constructor(inviteRepo: IInviteRepository, eventBus: IEventBus) {
        this.inviteRepo = inviteRepo;
        this.eventBus = eventBus;
    }
    async execute(input: RevokeInviteInput): Promise<Invite> {
        const existing = await this.inviteRepo.findByEmail(input.tenantId, input.email);
        if (!existing) {
            throw new NotFoundError('Invite', input.email);
        }
        const updated = await this.inviteRepo.update(input.tenantId, input.email, {
            status: 'revoked',
        });
        await this.eventBus.publish({
            eventType: 'invite.revoked',
            occurredAt: new Date().toISOString(),
            tenantId: input.tenantId,
            payload: { email: input.email },
        });
        return updated;
    }
}
