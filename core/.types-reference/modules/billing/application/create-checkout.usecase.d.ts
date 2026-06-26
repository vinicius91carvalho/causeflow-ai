import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { CheckoutInput } from '../domain/billing.types.js';
export declare class CreateCheckoutUseCase {
    private readonly tenantRepo;
    constructor(tenantRepo: ITenantRepository);
    execute(input: CheckoutInput): Promise<{
        url: string;
    }>;
}
