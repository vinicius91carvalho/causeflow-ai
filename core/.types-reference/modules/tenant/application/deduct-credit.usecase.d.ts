import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { ITenantRepository } from '../domain/tenant.repository.js';
export interface CreditDeductionResult {
    deducted: boolean;
    creditsTotal: number;
    creditsUsed: number;
    creditsRemaining: number;
}
export declare class DeductCreditUseCase {
    private readonly repo;
    constructor(repo: ITenantRepository);
    execute(tenantId: TenantId): Promise<CreditDeductionResult>;
}
