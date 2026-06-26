import type { ITenantRepository } from '../domain/tenant.repository.js';
import type { Tenant } from '../domain/tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class DynamoTenantRepository implements ITenantRepository {
    create(tenant: Tenant): Promise<Tenant>;
    findById(id: TenantId): Promise<Tenant | null>;
    findBySlug(slug: string): Promise<Tenant | null>;
    update(id: TenantId, data: Partial<Omit<Tenant, 'tenantId' | 'createdAt'>>): Promise<Tenant>;
    listByOwner(ownerEmail: string, options?: {
        limit?: number;
        cursor?: string;
    }): Promise<{
        items: Tenant[];
        cursor?: string;
    }>;
    deductCreditAtomic(tid: TenantId): Promise<boolean>;
    refundCreditAtomic(tid: TenantId): Promise<boolean>;
}
