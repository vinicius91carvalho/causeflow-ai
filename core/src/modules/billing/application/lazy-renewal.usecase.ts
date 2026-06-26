import { TenantNotFoundError } from '../../tenant/domain/tenant.errors.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { Tenant } from '../../tenant/domain/tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export class LazyRenewalUseCase {
    tenantRepo;
    constructor(tenantRepo: ITenantRepository) {
        this.tenantRepo = tenantRepo;
    }
    async execute(tenantId: TenantId): Promise<Tenant> {
        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new TenantNotFoundError(tenantId);
        }
        const now = new Date();
        // Canceled subscription: suspend tenant after period ends
        if (tenant.subscriptionStatus === 'canceled' && tenant.currentPeriodEnd) {
            const periodEnd = new Date(tenant.currentPeriodEnd);
            if (now > periodEnd) {
                return this.tenantRepo.update(tenantId, {
                    status: 'suspended',
                    subscriptionStatus: undefined,
                    stripeSubscriptionId: undefined,
                    cancelAtPeriodEnd: false,
                    updatedAt: now.toISOString(),
                });
            }
        }
        return tenant;
    }
}
