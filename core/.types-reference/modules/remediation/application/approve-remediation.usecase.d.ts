import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId, RemediationId } from '../../../shared/domain/value-objects.js';
export interface ApproveRemediationInput {
    tenantId: TenantId;
    remediationId: RemediationId;
    approvedBy: string;
}
export declare class ApproveRemediationUseCase {
    private readonly remediationRepo;
    private readonly eventBus;
    constructor(remediationRepo: IRemediationRepository, eventBus: IEventBus);
    execute(input: ApproveRemediationInput): Promise<Remediation>;
}
