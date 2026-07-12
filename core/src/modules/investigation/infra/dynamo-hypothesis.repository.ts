import { HypothesisEntity } from '../../../shared/infra/db/entities/HypothesisEntity.js';
import type { IHypothesisRepository } from '../domain/hypothesis.repository.js';
import type {
  Hypothesis,
  HypothesisEvidenceRef,
  HypothesisStatus,
} from '../domain/hypothesis.entity.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

function toDomain(raw: Record<string, unknown>): Hypothesis {
  return {
    tenantId: raw['tenantId'] as TenantId,
    incidentId: raw['incidentId'] as IncidentId,
    hypothesisId: raw['hypothesisId'] as string,
    statement: raw['statement'] as string,
    rationale: raw['rationale'] as string | undefined,
    informedBy: raw['informedBy'] as string[] | undefined,
    confidence: (raw['confidence'] as number | undefined) ?? 0,
    evidenceFor: (raw['evidenceFor'] as HypothesisEvidenceRef[] | undefined) ?? [],
    evidenceAgainst: (raw['evidenceAgainst'] as HypothesisEvidenceRef[] | undefined) ?? [],
    status: (raw['status'] as HypothesisStatus | undefined) ?? 'pending',
    finalScore: raw['finalScore'] as number | undefined,
    rejectedReason: raw['rejectedReason'] as string | undefined,
    parentId: raw['parentId'] as string | undefined,
    createdAt: raw['createdAt'] as string,
    updatedAt: raw['updatedAt'] as string,
  };
}

export class DynamoHypothesisRepository implements IHypothesisRepository {
  async create(hypothesis: Hypothesis): Promise<Hypothesis> {
    const result = await HypothesisEntity.create({
      tenantId: hypothesis.tenantId,
      incidentId: hypothesis.incidentId,
      hypothesisId: hypothesis.hypothesisId,
      statement: hypothesis.statement,
      rationale: hypothesis.rationale,
      informedBy: hypothesis.informedBy,
      confidence: hypothesis.confidence,
      evidenceFor: hypothesis.evidenceFor,
      evidenceAgainst: hypothesis.evidenceAgainst,
      status: hypothesis.status,
      finalScore: hypothesis.finalScore,
      rejectedReason: hypothesis.rejectedReason,
      parentId: hypothesis.parentId,
    }).go();
    return toDomain(result.data as unknown as Record<string, unknown>);
  }

  async findById(
    tenantId: TenantId,
    incidentId: IncidentId,
    hypothesisId: string,
  ): Promise<Hypothesis | null> {
    const result = await HypothesisEntity.get({ tenantId, incidentId, hypothesisId }).go();
    if (!result.data) return null;
    return toDomain(result.data as unknown as Record<string, unknown>);
  }

  async listByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Hypothesis[]> {
    const result = await HypothesisEntity.query.primary({ tenantId, incidentId }).go();
    return result.data.map((item) => toDomain(item as unknown as Record<string, unknown>));
  }

  async update(
    tenantId: TenantId,
    incidentId: IncidentId,
    hypothesisId: string,
    patch: Partial<Omit<Hypothesis, 'hypothesisId' | 'tenantId' | 'incidentId' | 'createdAt'>>,
  ): Promise<Hypothesis> {
    const result = await HypothesisEntity.patch({ tenantId, incidentId, hypothesisId })
      .set(patch as Record<string, unknown>)
      .go({ response: 'all_new' });
    return toDomain(result.data as unknown as Record<string, unknown>);
  }
}
