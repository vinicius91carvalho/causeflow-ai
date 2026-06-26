import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { User } from './user.entity.js';
export interface IUserRepository {
    create(user: User): Promise<User>;
    findById(tenantId: TenantId, userId: string): Promise<User | null>;
    findByUserId(userId: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByTenant(tenantId: TenantId): Promise<User[]>;
    update(tenantId: TenantId, userId: string, data: Partial<User>): Promise<User>;
    delete(tenantId: TenantId, userId: string): Promise<void>;
}
