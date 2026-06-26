import type { Tenant } from './tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface ListOptions {
    limit?: number;
    cursor?: string;
}
export interface ITenantRepository {
    create(tenant: Tenant): Promise<Tenant>;
    findById(tenantId: TenantId): Promise<Tenant | null>;
    findBySlug(slug: string): Promise<Tenant | null>;
    findByCustomDomain(domain: string): Promise<Tenant | null>;
    update(tenantId: TenantId, data: Partial<Omit<Tenant, 'tenantId' | 'createdAt'>>): Promise<Tenant>;
    listByOwner(ownerEmail: string, options?: ListOptions): Promise<{
        items: Tenant[];
        cursor?: string;
    }>;
}
