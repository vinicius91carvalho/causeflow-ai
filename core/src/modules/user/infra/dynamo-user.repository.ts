import { tenantId } from '../../../shared/domain/value-objects.js';
import { UserEntity } from '../../../shared/infra/db/entities/UserEntity.js';
import type { IUserRepository } from '../domain/user.repository.js';
import type { User } from '../domain/user.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
function toDomain(raw: Record<string, any>) {
    return {
        tenantId: tenantId(raw['tenantId']),
        userId: raw['userId'],
        email: raw['email'],
        name: raw['name'],
        role: raw['role'],
        profileComplete: raw['profileComplete'] ?? false,
        termsAcceptedAt: raw['termsAcceptedAt'],
        createdAt: raw['createdAt'],
        updatedAt: raw['updatedAt'],
    };
}
export class DynamoUserRepository {
    async create(user: User): Promise<User> {
        const result = await UserEntity.create({
            tenantId: user.tenantId,
            userId: user.userId,
            email: user.email,
            name: user.name,
            role: user.role,
            profileComplete: user.profileComplete,
            termsAcceptedAt: user.termsAcceptedAt,
        }).go();
        return toDomain(result.data);
    }
    async findById(tid: TenantId, userId: string): Promise<User | null> {
        const result = await UserEntity.get({ tenantId: tid, userId }).go();
        if (!result.data)
            return null;
        return toDomain(result.data);
    }
    async findByUserId(userId: string): Promise<User | null> {
        const result = await UserEntity.query.byUserId({ userId }).go();
        const first = result.data[0];
        if (!first)
            return null;
        return toDomain(first);
    }
    async findByEmail(email: string): Promise<User | null> {
        const result = await UserEntity.query.byEmail({ email }).go();
        const first = result.data[0];
        if (!first)
            return null;
        return toDomain(first);
    }
    async findByTenant(tid: TenantId): Promise<User[]> {
        const result = await UserEntity.query.primary({ tenantId: tid }).go();
        return result.data.map((item) => toDomain(item));
    }
    async update(tid: TenantId, userId: string, data: Partial<User>): Promise<User> {
        const result = await UserEntity.patch({ tenantId: tid, userId })
            .set(data)
            .go({ response: 'all_new' });
        return toDomain(result.data);
    }
    async delete(tid: TenantId, userId: string): Promise<void> {
        await UserEntity.delete({ tenantId: tid, userId }).go();
    }
}
