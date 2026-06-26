import type { IInviteRepository } from '../domain/invite.repository.js';
import type { Invite } from '../domain/invite.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class DynamoInviteRepository implements IInviteRepository {
    create(invite: Invite): Promise<Invite>;
    findByEmail(tid: TenantId, email: string): Promise<Invite | null>;
    findByTenant(tid: TenantId): Promise<Invite[]>;
    update(tid: TenantId, email: string, data: Partial<Invite>): Promise<Invite>;
    delete(tid: TenantId, email: string): Promise<void>;
}
