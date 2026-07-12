/**
 * Postgres Evidence repository implementation for the OSS runtime (AC-040).
 * Replaces DynamoEvidenceRepository in the OSS path.
 */
import { evidenceId, toolCallId as toToolCallId } from '../../../shared/domain/value-objects.js';
import { pgInsert, pgQuery } from '../../../shared/infra/db/postgres/pg-utils.js';
import type { IEvidenceRepository, Evidence } from '../domain/evidence.repository.js';
import type { AgentRole } from '../../../shared/domain/types.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

const TABLE = 'evidence';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): Evidence {
  return {
    tenantId: row.tenant_id as TenantId,
    incidentId: row.data['incidentId'] as IncidentId,
    evidenceId: evidenceId(row.entity_id),
    agentRole: row.data['agentRole'] as AgentRole,
    evidenceType: row.data['evidenceType'] as Evidence['evidenceType'],
    content: row.data['content'] as string,
    toolCallId: row.data['toolCallId'] ? toToolCallId(row.data['toolCallId'] as string) : undefined,
    claim: row.data['claim'] as string | undefined,
    quote: row.data['quote'] as string | undefined,
    metadata: row.data['metadata'] as Evidence['metadata'],
    createdAt: row.created_at,
  };
}

export class PgEvidenceRepository implements IEvidenceRepository {
  async create(evidence: Evidence): Promise<Evidence> {
    const data: Record<string, unknown> = {
      incidentId: evidence.incidentId,
      agentRole: evidence.agentRole,
      evidenceType: evidence.evidenceType,
      content: evidence.content,
      toolCallId: evidence.toolCallId,
      claim: evidence.claim,
      quote: evidence.quote,
      metadata: evidence.metadata,
    };
    const row = await pgInsert(TABLE, evidence.tenantId, String(evidence.evidenceId), data);
    return toDomain(row);
  }

  async findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Evidence[]> {
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND data->>'incidentId' = $2",
      [tenantId, incidentId],
      { orderBy: 'created_at ASC' },
    );
    return rows.map(toDomain);
  }

  async listByAgentRole(incidentId: IncidentId, agentRole: AgentRole): Promise<Evidence[]> {
    // listByAgentRole has no tenantId parameter in the interface — query across tenant
    // by incidentId + agentRole stored in JSONB
    const rows = await pgQuery(
      TABLE,
      "data->>'incidentId' = $1 AND data->>'agentRole' = $2",
      [incidentId, agentRole],
      { orderBy: 'created_at ASC' },
    );
    return rows.map(toDomain);
  }
}
