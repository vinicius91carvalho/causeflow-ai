/**
 * Postgres Billing Account repository for the OSS runtime (AC-050).
 * Implements a simple stub that always returns a free-plan account.
 */
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { BillingAccount } from '../domain/billing-account.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';

export class PgBillingAccountRepository implements IBillingAccountRepository {
    async create(account: BillingAccount): Promise<BillingAccount> {
        return account;
    }

    async findByTenantId(tenantId: TenantId): Promise<BillingAccount | null> {
        return {
            tenantId,
            investigationsLimit: -1,
            investigationsUsed: 0,
            eventsLimit: -1,
            eventsUsed: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    async update(tenantId: TenantId, data: Partial<Omit<BillingAccount, 'tenantId' | 'createdAt'>>): Promise<BillingAccount> {
        const account = await this.findByTenantId(tenantId);
        if (!account) throw new Error(`Billing account not found for ${tenantId}`);
        return { ...account, ...data, updatedAt: new Date().toISOString() };
    }

    async incrementUsageAtomic(tenantId: TenantId, type: UsageType): Promise<boolean> {
        return true;
    }

    async reserveInvestigation(tenantId: TenantId): Promise<{ reserved: boolean; reason?: string }> {
        return { reserved: true };
    }

    async confirmInvestigation(tenantId: TenantId): Promise<void> {
        // no-op
    }

    async refundInvestigation(tenantId: TenantId): Promise<void> {
        // no-op
    }
}
