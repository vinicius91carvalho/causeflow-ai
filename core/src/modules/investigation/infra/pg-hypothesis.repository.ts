/**
 * Postgres Hypothesis repository implementation for the OSS runtime (AC-040).
 */
import { pgGet, pgInsert, pgQuery, pgUpdate } from '../../../shared/infra/db/postgres/pg-utils.js';
import type { IHypothesisRepository } from '../domain/hypothesis.repository.js';
import type {
  Hypothesis,
  HypothesisEvidenceRef,
  HypothesisStatus,
} from '../domain/hypothesis.entity.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

const TABLE = 'hypotheses';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): Hypothesis {
  return {
    tenantId: row.tenant_id as TenantId,
    incidentId: row.data['incidentId'] as IncidentId,
    hypothesisId: row.entity_id,
    statement: row.data['statement'] as string,
    rationale: row.data['rationale'] as string | undefined,
    informedBy: row.data['informedBy'] as string[] | undefined,
    confidence: (row.data['confidence'] as number | undefined) ?? 0,
    evidenceFor: (row.data['evidenceFor'] as HypothesisEvidenceRef[] | undefined) ?? [],
    evidenceAgainst: (row.data['evidenceAgainst'] as HypothesisEvidenceRef[] | undefined) ?? [],
    status: (row.data['status'] as HypothesisStatus | undefined) ?? 'pending',
    finalScore: row.data['finalScore'] as number | undefined,
    rejectedReason: row.data['rejectedReason'] as string | undefined,
    parentId: row.data['parentId'] as string | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toData(hypothesis: Hypothesis): Record<string, unknown> {
  return {
    incidentId: hypothesis.incidentId,
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
  };
}

export class PgHypothesisRepository implements IHypothesisRepository {
  async create(hypothesis: Hypothesis): Promise<Hypothesis> {
    const row = await pgInsert(
      TABLE,
      hypothesis.tenantId,
      hypothesis.hypothesisId,
      toData(hypothesis),
    );
    return toDomain(row);
  }

  async findById(
    tenantId: TenantId,
    incidentId: IncidentId,
    hypothesisId: string,
  ): Promise<Hypothesis | null> {
    const row = await pgGet(TABLE, tenantId, hypothesisId);
    if (!row || row.data['incidentId'] !== incidentId) return null;
    return toDomain(row);
  }

  async listByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Hypothesis[]> {
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND data->>'incidentId' = $2",
      [tenantId, incidentId],
      { orderBy: 'created_at ASC' },
    );
    return rows.map(toDomain);
  }

  async update(
    tenantId: TenantId,
    incidentId: IncidentId,
    hypothesisId: string,
    patch: Partial<Omit<Hypothesis, 'hypothesisId' | 'tenantId' | 'incidentId' | 'createdAt'>>,
  ): Promise<Hypothesis> {
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) updateData[key] = value;
    }
    const row = await pgUpdate(TABLE, tenantId, hypothesisId, updateData);
    if (row.data['incidentId'] !== incidentId) {
      throw new Error(`Hypothesis ${hypothesisId} does not belong to incident ${incidentId}`);
    }
    return toDomain(row);
  }
}
