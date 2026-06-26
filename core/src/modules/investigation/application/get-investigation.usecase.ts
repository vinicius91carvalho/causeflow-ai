import { NotFoundError } from '../../../shared/domain/errors.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEvidenceRepository, Evidence } from '../../triage/domain/evidence.repository.js';
import type { Incident } from '../../ingestion/domain/incident.entity.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

export interface InvestigationDetail {
    incident: Incident;
    evidenceByAgent: Record<string, Evidence[]>;
}

export class GetInvestigationUseCase {
    incidentRepo;
    evidenceRepo;
    constructor(incidentRepo: IIncidentRepository, evidenceRepo: IEvidenceRepository) {
        this.incidentRepo = incidentRepo;
        this.evidenceRepo = evidenceRepo;
    }
    async execute(tenantId: TenantId, incidentId: IncidentId): Promise<InvestigationDetail> {
        const incident = await this.incidentRepo.findById(tenantId, incidentId);
        if (!incident) {
            throw new NotFoundError('Incident', incidentId);
        }
        const allEvidence = await this.evidenceRepo.findByIncident(tenantId, incidentId);
        const evidenceByAgent: Record<string, Evidence[]> = {};
        for (const ev of allEvidence) {
            const role = ev.agentRole;
            if (!evidenceByAgent[role]) {
                evidenceByAgent[role] = [];
            }
            evidenceByAgent[role].push(ev);
        }
        return { incident, evidenceByAgent };
    }
}
