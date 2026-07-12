/**
 * Postgres ToolCall repository implementation for the OSS runtime (AC-040).
 * Replaces DynamoToolCallRepository in the OSS path.
 */
import { toolCallId as toToolCallId } from '../../../shared/domain/value-objects.js';
import { pgGet, pgInsert, pgQuery } from '../../../shared/infra/db/postgres/pg-utils.js';
import type { IToolCallRepository, ToolCallLog } from '../domain/tool-call.repository.js';
import type { IncidentId, TenantId, ToolCallId } from '../../../shared/domain/value-objects.js';

const TABLE = 'tool_calls';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): ToolCallLog {
  return {
    tenantId: row.tenant_id as TenantId,
    incidentId: row.data['incidentId'] as IncidentId,
    toolCallId: toToolCallId(row.entity_id),
    agentRole: row.data['agentRole'] as ToolCallLog['agentRole'],
    name: row.data['name'] as string,
    origin: row.data['origin'] as 'real' | 'synthetic_memory',
    input: (row.data['input'] ?? {}) as Record<string, unknown>,
    output: (row.data['output'] ?? '') as string,
    success: (row.data['success'] ?? true) as boolean,
    metadata: row.data['metadata'] as ToolCallLog['metadata'],
    createdAt: row.created_at,
  };
}

export class PgToolCallRepository implements IToolCallRepository {
  async create(record: ToolCallLog): Promise<ToolCallLog> {
    const data: Record<string, unknown> = {
      incidentId: record.incidentId,
      agentRole: record.agentRole,
      name: record.name,
      origin: record.origin,
      input: record.input,
      output: record.output,
      success: record.success,
      metadata: record.metadata,
    };
    const row = await pgInsert(TABLE, record.tenantId, String(record.toolCallId), data);
    return toDomain(row);
  }

  async findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<ToolCallLog[]> {
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND data->>'incidentId' = $2",
      [tenantId, incidentId],
      { orderBy: 'created_at ASC' },
    );
    return rows.map(toDomain);
  }

  async findById(
    tenantId: TenantId,
    incidentId: IncidentId,
    toolCallId: ToolCallId,
  ): Promise<ToolCallLog | null> {
    // The entity_id is the toolCallId; verify tenant + incident match
    const row = await pgGet(TABLE, tenantId, String(toolCallId));
    if (!row) return null;
    const domain = toDomain(row);
    if (domain.incidentId !== incidentId) return null;
    return domain;
  }
}
