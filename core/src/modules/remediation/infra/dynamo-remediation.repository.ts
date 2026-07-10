import { remediationId } from '../../../shared/domain/value-objects.js';
import { RemediationEntity } from '../../../shared/infra/db/entities/RemediationEntity.js';
import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { IncidentId, RemediationId, TenantId } from '../../../shared/domain/value-objects.js';
function toDomain(raw: Record<string, any>) {
    return {
        remediationId: remediationId(raw['remediationId']),
        tenantId: raw['tenantId'],
        incidentId: raw['incidentId'],
        rollbackOf: raw['rollbackOf'] ? remediationId(raw['rollbackOf']) : undefined,
        status: raw['status'],
        description: raw['description'],
        rootCause: raw['rootCause'],
        steps: raw['steps'] ?? [],
        proposedBy: raw['proposedBy'],
        approvedBy: raw['approvedBy'],
        rejectedBy: raw['rejectedBy'],
        rejectionReason: raw['rejectionReason'],
        pullRequests: raw['pullRequests'] ?? undefined,
        completedAt: raw['completedAt'],
        createdAt: raw['createdAt'],
        updatedAt: raw['updatedAt'],
    };
}
export class DynamoRemediationRepository {
    async create(remediation: Remediation): Promise<Remediation> {
        const result = await RemediationEntity.create({
            tenantId: remediation.tenantId,
            remediationId: remediation.remediationId,
            incidentId: remediation.incidentId,
            status: remediation.status,
            description: remediation.description,
            rootCause: remediation.rootCause,
            steps: remediation.steps,
            proposedBy: remediation.proposedBy,
            rollbackOf: remediation.rollbackOf,
        }).go();
        return toDomain(result.data);
    }
    async findById(tenantId: TenantId, id: RemediationId): Promise<Remediation | null> {
        const result = await RemediationEntity.get({ tenantId, remediationId: id }).go();
        if (!result.data)
            return null;
        return toDomain(result.data);
    }
    async findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Remediation[]> {
        const result = await RemediationEntity.query.byIncident({ tenantId, incidentId }).go();
        return result.data.map((item) => toDomain(item));
    }
    async update(tenantId: TenantId, id: RemediationId, data: Partial<Remediation>): Promise<Remediation> {
        const result = await RemediationEntity.patch({ tenantId, remediationId: id })
            .set(data)
            .go({ response: 'all_new' });
        return toDomain(result.data);
    }
}
