import { evidenceId, toolCallId as toToolCallId } from '../../../shared/domain/value-objects.js';
import { EvidenceEntity } from '../../../shared/infra/db/entities/EvidenceEntity.js';
import type { IEvidenceRepository, Evidence } from '../domain/evidence.repository.js';
import type { AgentRole } from '../../../shared/domain/types.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
function toDomain(raw: Record<string, any>) {
    return {
        tenantId: raw['tenantId'],
        incidentId: raw['incidentId'],
        evidenceId: evidenceId(raw['evidenceId']),
        agentRole: raw['agentRole'],
        evidenceType: raw['evidenceType'],
        content: raw['content'],
        toolCallId: raw['toolCallId'] ? toToolCallId(raw['toolCallId']) : undefined,
        claim: raw['claim'],
        quote: raw['quote'],
        metadata: raw['metadata'],
        createdAt: raw['createdAt'],
    };
}
export class DynamoEvidenceRepository {
    async create(evidence: Evidence): Promise<Evidence> {
        const result = await EvidenceEntity.create({
            tenantId: evidence.tenantId,
            incidentId: evidence.incidentId,
            evidenceId: evidence.evidenceId,
            agentRole: evidence.agentRole,
            evidenceType: evidence.evidenceType,
            content: evidence.content,
            toolCallId: evidence.toolCallId,
            claim: evidence.claim,
            quote: evidence.quote,
            metadata: evidence.metadata,
        }).go();
        return toDomain(result.data);
    }
    async findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Evidence[]> {
        const id = incidentId;
        const result = await EvidenceEntity.query.primary({ tenantId }).where(({ incidentId: incId }, { eq }) => eq(incId, id as string)).go();
        return result.data.map((item) => toDomain(item));
    }
    async listByAgentRole(incidentId: IncidentId, agentRole: AgentRole): Promise<Evidence[]> {
        const result = await EvidenceEntity.query.byAgentRole({ incidentId, agentRole }).go();
        return result.data.map((item) => toDomain(item));
    }
}
