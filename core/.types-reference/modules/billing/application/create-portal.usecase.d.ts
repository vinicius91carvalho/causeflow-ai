import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { PortalInput } from '../domain/billing.types.js';
export declare class CreatePortalUseCase {
    private readonly tenantRepo;
    constructor(tenantRepo: ITenantRepository);
    execute(input: PortalInput): Promise<{
        url: string;
    }>;
}
