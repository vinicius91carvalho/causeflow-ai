import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ChatPlatform } from '../../../shared/application/ports/chat-platform.port.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
import type { StructuredAction, ProposedFix } from '../../investigation/domain/investigation.types.js';
export interface ProposeRemediationInput {
    tenantId: TenantId;
    incidentId: IncidentId;
    rootCause: string;
    recommendedActions: StructuredAction[];
    proposedFix?: ProposedFix;
}
export declare class ProposeRemediationUseCase {
    private readonly remediationRepo;
    private readonly incidentRepo;
    private readonly eventBus;
    private readonly chatPlatform?;
    constructor(remediationRepo: IRemediationRepository, incidentRepo: IIncidentRepository, eventBus: IEventBus, chatPlatform?: ChatPlatform | undefined);
    execute(input: ProposeRemediationInput): Promise<Remediation>;
}
