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
    update(tenantId: TenantId, data: Partial<Omit<Tenant, 'tenantId' | 'createdAt'>>): Promise<Tenant>;
    listByOwner(ownerEmail: string, options?: ListOptions): Promise<{
        items: Tenant[];
        cursor?: string;
    }>;
    /**
     * Atomically deduct 1 credit (creditsUsed++) if creditsUsed < creditsTotal.
     * @returns true if deducted, false if exhausted
     */
    deductCreditAtomic(tenantId: TenantId): Promise<boolean>;
    /**
     * Atomically refund 1 credit (creditsUsed--) if creditsUsed > 0.
     * Used to roll back a credit when incident creation fails.
     * @returns true if refunded, false if already zero
     */
    refundCreditAtomic(tenantId: TenantId): Promise<boolean>;
}
