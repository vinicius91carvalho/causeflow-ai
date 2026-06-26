import type { IUserRepository } from '../domain/user.repository.js';
import type { User } from '../domain/user.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class DynamoUserRepository implements IUserRepository {
    create(user: User): Promise<User>;
    findById(tid: TenantId, userId: string): Promise<User | null>;
    findByUserId(userId: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByTenant(tid: TenantId): Promise<User[]>;
    update(tid: TenantId, userId: string, data: Partial<User>): Promise<User>;
    delete(tid: TenantId, userId: string): Promise<void>;
}
