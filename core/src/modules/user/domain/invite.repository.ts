import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { Invite } from './invite.entity.js';
export interface IInviteRepository {
    create(invite: Invite): Promise<Invite>;
    findByEmail(tenantId: TenantId, email: string): Promise<Invite | null>;
    findByTenant(tenantId: TenantId): Promise<Invite[]>;
    update(tenantId: TenantId, email: string, data: Partial<Invite>): Promise<Invite>;
    delete(tenantId: TenantId, email: string): Promise<void>;
}
