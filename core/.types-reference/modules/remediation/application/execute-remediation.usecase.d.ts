import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { CloudProvider } from '../../../shared/application/ports/cloud-provider.port.js';
import type { CredentialVendor } from '../../../shared/application/ports/credential-vendor.port.js';
import type { ICodeRepository } from '../../../shared/application/ports/code-repository.port.js';
import type { TenantId, RemediationId } from '../../../shared/domain/value-objects.js';
export interface ExecuteRemediationInput {
    tenantId: TenantId;
    remediationId: RemediationId;
}
export declare class ExecuteRemediationUseCase {
    private readonly remediationRepo;
    private readonly incidentRepo;
    private readonly eventBus;
    private readonly cloudProvider;
    private readonly credentialVendor?;
    private readonly codeRepoFactory?;
    constructor(remediationRepo: IRemediationRepository, incidentRepo: IIncidentRepository, eventBus: IEventBus, cloudProvider: CloudProvider, credentialVendor?: CredentialVendor | undefined, codeRepoFactory?: ((tenantId: TenantId) => ICodeRepository | undefined) | undefined);
    execute(input: ExecuteRemediationInput): Promise<Remediation>;
    private executeCreateFixPR;
    private buildPRBody;
}
