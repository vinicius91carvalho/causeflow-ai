import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEvidenceRepository, Evidence } from '../../triage/domain/evidence.repository.js';
import type { Incident } from '../../ingestion/domain/incident.entity.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
export interface InvestigationDetail {
    incident: Incident;
    evidenceByAgent: Record<string, Evidence[]>;
}
export declare class GetInvestigationUseCase {
    private readonly incidentRepo;
    private readonly evidenceRepo;
    constructor(incidentRepo: IIncidentRepository, evidenceRepo: IEvidenceRepository);
    execute(tenantId: TenantId, incidentId: IncidentId): Promise<InvestigationDetail>;
}
