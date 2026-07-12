/**
 * Postgres Approval repository for the OSS runtime (AC-047).
 * Persists ApprovalEntity rows so approve/execute/rollback can be audited.
 */
import type { IApprovalRepository } from '../domain/approval.repository.js';
import type { PendingApproval } from '../domain/approval.entity.js';
import type { ApprovalId, TenantId } from '../../../shared/domain/value-objects.js';
import {
  approvalId,
  notificationId,
  incidentId,
  remediationId,
} from '../../../shared/domain/value-objects.js';
import { pgGet, pgInsert, pgUpdate, pgQuery } from '../../../shared/infra/db/postgres/pg-utils.js';

const TABLE = 'approvals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): PendingApproval {
  const data = row.data as Record<string, unknown>;
  return {
    approvalId: approvalId(row.entity_id),
    tenantId: row.tenant_id,
    notificationId: notificationId(data['notificationId'] as string),
    incidentId: incidentId(data['incidentId'] as string),
    remediationId: remediationId(data['remediationId'] as string),
    title: data['title'] as string,
    description: data['description'] as string,
    actions: (data['actions'] as PendingApproval['actions']) ?? [],
    status: data['status'] as PendingApproval['status'],
    respondedBy: data['respondedBy'] as string | undefined,
    selectedAction: data['selectedAction'] as string | undefined,
    timeoutMinutes: (data['timeoutMinutes'] as number) ?? 30,
    expiresAt: data['expiresAt'] as string,
    createdAt: (data['createdAt'] as string) ?? row.created_at,
    updatedAt: (data['updatedAt'] as string) ?? row.updated_at,
  };
}

export class PgApprovalRepository implements IApprovalRepository {
  async create(approval: PendingApproval): Promise<PendingApproval> {
    const data: Record<string, unknown> = {
      notificationId: approval.notificationId,
      incidentId: approval.incidentId,
      remediationId: approval.remediationId,
      title: approval.title,
      description: approval.description,
      actions: approval.actions,
      status: approval.status,
      respondedBy: approval.respondedBy,
      selectedAction: approval.selectedAction,
      timeoutMinutes: approval.timeoutMinutes,
      expiresAt: approval.expiresAt,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt,
    };
    const row = await pgInsert(TABLE, approval.tenantId, approval.approvalId, data);
    return toDomain(row);
  }

  async findById(tenantId: TenantId, aid: ApprovalId): Promise<PendingApproval | null> {
    const row = await pgGet(TABLE, tenantId, aid);
    if (!row) return null;
    return toDomain(row);
  }

  async findPendingByTenant(tenantId: TenantId): Promise<PendingApproval[]> {
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND data->>'status' = $2",
      [tenantId, 'pending'],
      { orderBy: 'created_at DESC' },
    );
    return rows.map(toDomain);
  }

  async update(
    tenantId: TenantId,
    aid: ApprovalId,
    updates: Partial<PendingApproval>,
  ): Promise<PendingApproval> {
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) updateData[key] = value;
    }
    const row = await pgUpdate(TABLE, tenantId, aid, updateData);
    return toDomain(row);
  }
}
