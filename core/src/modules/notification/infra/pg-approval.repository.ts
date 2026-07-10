/**
 * In-memory approval repository for the OSS runtime (AC-029).
 *
 * In-memory storage so the approval module works without DynamoDB.
 * The OSS runtime does not require persistent approvals across restarts.
 */
import type { IApprovalRepository } from '../domain/approval.repository.js';
import type { PendingApproval } from '../domain/approval.entity.js';
import type { ApprovalId, TenantId } from '../../../shared/domain/value-objects.js';

const store = new Map<string, PendingApproval>();

function key(tenantId: string, id: string): string {
  return `${tenantId}::${id}`;
}

export class PgApprovalRepository implements IApprovalRepository {
  async create(approval: PendingApproval): Promise<PendingApproval> {
    const stored: PendingApproval = {
      ...approval,
      createdAt: approval.createdAt ?? new Date().toISOString(),
      updatedAt: approval.updatedAt ?? new Date().toISOString(),
    };
    store.set(key(approval.tenantId, approval.approvalId), stored);
    return stored;
  }

  async findById(tenantId: TenantId, approvalId: ApprovalId): Promise<PendingApproval | null> {
    return store.get(key(tenantId, approvalId)) ?? null;
  }

  async findPendingByTenant(tenantId: TenantId): Promise<PendingApproval[]> {
    const result: PendingApproval[] = [];
    for (const [k, v] of store) {
      if (k.startsWith(tenantId + '::') && v.status === 'pending') {
        result.push(v);
      }
    }
    return result.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  async update(tenantId: TenantId, approvalId: ApprovalId, updates: Partial<PendingApproval>): Promise<PendingApproval> {
    const existing = store.get(key(tenantId, approvalId));
    if (!existing) throw new Error(`Approval not found: ${approvalId}`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    store.set(key(tenantId, approvalId), updated);
    return updated;
  }
}
