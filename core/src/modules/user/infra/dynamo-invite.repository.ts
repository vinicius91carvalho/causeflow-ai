import { tenantId } from '../../../shared/domain/value-objects.js';
import { InviteEntity } from '../../../shared/infra/db/entities/InviteEntity.js';
import type { IInviteRepository } from '../domain/invite.repository.js';
import type { Invite } from '../domain/invite.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
function toDomain(raw: Record<string, any>) {
    return {
        tenantId: tenantId(raw['tenantId']),
        email: raw['email'],
        invitedBy: raw['invitedBy'],
        role: raw['role'],
        status: raw['status'],
        expiresAt: raw['expiresAt'],
        createdAt: raw['createdAt'],
        updatedAt: raw['updatedAt'],
    };
}
export class DynamoInviteRepository {
    async create(invite: Invite): Promise<Invite> {
        const result = await InviteEntity.create({
            tenantId: invite.tenantId,
            email: invite.email,
            invitedBy: invite.invitedBy,
            role: invite.role,
            status: invite.status,
            expiresAt: invite.expiresAt,
        }).go();
        return toDomain(result.data);
    }
    async findByEmail(tid: TenantId, email: string): Promise<Invite | null> {
        const result = await InviteEntity.get({ tenantId: tid, email }).go();
        if (!result.data)
            return null;
        return toDomain(result.data);
    }
    async findByTenant(tid: TenantId): Promise<Invite[]> {
        const result = await InviteEntity.query.primary({ tenantId: tid }).go();
        return result.data.map((item) => toDomain(item));
    }
    async update(tid: TenantId, email: string, data: Partial<Invite>): Promise<Invite> {
        const result = await InviteEntity.patch({ tenantId: tid, email })
            .set(data)
            .go({ response: 'all_new' });
        return toDomain(result.data);
    }
    async delete(tid: TenantId, email: string): Promise<void> {
        await InviteEntity.delete({ tenantId: tid, email }).go();
    }
}
