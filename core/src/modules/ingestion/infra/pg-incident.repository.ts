/**
 * Postgres Incident repository implementation for the OSS runtime (AC-040).
 */
import type { IIncidentRepository, ListOptions } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { IncidentStatus, Severity } from '../../../shared/domain/types.js';
import { pgGet, pgInsert, pgUpdate, pgQuery } from '../../../shared/infra/db/postgres/pg-utils.js';

const TABLE = 'incidents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): Incident {
  return {
    incidentId: row.entity_id as unknown as IncidentId,
    tenantId: row.tenant_id,
    title: row.data['title'] as string,
    description: (row.data['description'] ?? '') as string,
    severity: row.data['severity'] as Severity,
    status: row.data['status'] as IncidentStatus,
    sourceProvider: row.data['sourceProvider'] as string,
    sourceAlertId: (row.data['sourceAlertId'] ?? '') as string,
    assignedAgents: (row.data['assignedAgents'] as string[]) ?? [],
    rootCause: row.data['rootCause'] as string | undefined,
    recommendedActions: row.data['recommendedActions'] as Incident['recommendedActions'],
    knownSolutionPatternId: row.data['knownSolutionPatternId'] as string | undefined,
    knownSolutionStatus: row.data['knownSolutionStatus'] as Incident['knownSolutionStatus'],
    customerExplanation: row.data['customerExplanation'] as Incident['customerExplanation'],
    totalCostUsd: row.data['totalCostUsd'] as number | undefined,
    costBreakdown: row.data['costBreakdown'] as Incident['costBreakdown'],
    investigationDurationMs: row.data['investigationDurationMs'] as number | undefined,
    investigationMode: row.data['investigationMode'] as Incident['investigationMode'],
    shadowInvestigationMode: row.data[
      'shadowInvestigationMode'
    ] as Incident['shadowInvestigationMode'],
    resolution: row.data['resolution'] as string | undefined,
    resolvedAt: row.data['resolvedAt'] as string | undefined,
    slackNotificationTs: row.data['slackNotificationTs'] as string | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgIncidentRepository implements IIncidentRepository {
  async create(incident: Incident): Promise<Incident> {
    const data: Record<string, unknown> = {
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      status: incident.status,
      sourceProvider: incident.sourceProvider,
      sourceAlertId: incident.sourceAlertId,
      assignedAgents: incident.assignedAgents,
    };
    const row = await pgInsert(TABLE, incident.tenantId, incident.incidentId, data);
    return toDomain(row);
  }

  async findById(tenantId: TenantId, incidentId: IncidentId): Promise<Incident | null> {
    const row = await pgGet(TABLE, tenantId, incidentId);
    if (!row) return null;
    return toDomain(row);
  }

  async findBySourceAlert(
    tenantId: TenantId,
    sourceProvider: string,
    sourceAlertId: string,
  ): Promise<Incident | null> {
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND data->>'sourceProvider' = $2 AND data->>'sourceAlertId' = $3",
      [tenantId, sourceProvider, sourceAlertId],
      { limit: 1 },
    );
    if (rows.length === 0) return null;
    return toDomain(rows[0]);
  }

  async update(
    tenantId: TenantId,
    incidentId: IncidentId,
    data: Partial<Omit<Incident, 'incidentId' | 'tenantId' | 'createdAt'>>,
  ): Promise<Incident> {
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value;
    }
    const row = await pgUpdate(TABLE, tenantId, incidentId, updateData);
    return toDomain(row);
  }

  async updateStatus(
    tenantId: TenantId,
    incidentId: IncidentId,
    status: IncidentStatus,
    resolvedAt?: string,
  ): Promise<Incident> {
    const updateData: Record<string, unknown> = { status };
    if (resolvedAt) updateData['resolvedAt'] = resolvedAt;
    const row = await pgUpdate(TABLE, tenantId, incidentId, updateData);
    return toDomain(row);
  }

  async listByTenant(
    tenantId: TenantId,
    options?: ListOptions,
  ): Promise<{ items: Incident[]; cursor?: string }> {
    const rows = await pgQuery(TABLE, 'tenant_id = $1', [tenantId], {
      orderBy: 'created_at DESC',
      limit: options?.limit ?? 20,
      offset: options?.cursor ? parseInt(options.cursor, 10) : undefined,
    });
    return {
      items: rows.map(toDomain),
      cursor:
        rows.length === (options?.limit ?? 20)
          ? String((options?.cursor ? parseInt(options.cursor, 10) : 0) + rows.length)
          : undefined,
    };
  }

  async findBySeverity(
    tenantId: TenantId,
    severity: Severity,
    options?: ListOptions,
  ): Promise<{ items: Incident[]; cursor?: string }> {
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND data->>'severity' = $2",
      [tenantId, severity],
      {
        orderBy: 'created_at DESC',
        limit: options?.limit ?? 20,
      },
    );
    return { items: rows.map(toDomain) };
  }

  async findByStatus(
    tenantId: TenantId,
    severity: Severity,
    status: IncidentStatus,
    options?: ListOptions,
  ): Promise<{ items: Incident[]; cursor?: string }> {
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND data->>'severity' = $2 AND data->>'status' = $3",
      [tenantId, severity, status],
      {
        orderBy: 'created_at DESC',
        limit: options?.limit ?? 20,
      },
    );
    return { items: rows.map(toDomain) };
  }

  async listByCreatedAt(
    tenantId: TenantId,
    options?: ListOptions & { order?: 'asc' | 'desc' },
  ): Promise<{ items: Incident[]; cursor?: string }> {
    const rows = await pgQuery(TABLE, 'tenant_id = $1', [tenantId], {
      orderBy: `created_at ${options?.order === 'asc' ? 'ASC' : 'DESC'}`,
      limit: options?.limit ?? 20,
    });
    return { items: rows.map(toDomain) };
  }

  async findAll(tenantId: TenantId): Promise<Incident[]> {
    const rows = await pgQuery(TABLE, 'tenant_id = $1', [tenantId], { orderBy: 'created_at DESC' });
    return rows.map(toDomain);
  }
}
