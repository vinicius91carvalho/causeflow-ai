import type { TenantId, AuditEntryId } from '../../../shared/domain/value-objects.js';
import type { AuditAction } from '../../../shared/domain/types.js';
export type AuditActorType = 'user' | 'system' | 'agent';
export interface AuditEntry {
    tenantId: TenantId;
    entryId: AuditEntryId;
    action: AuditAction;
    actorType: AuditActorType;
    actorEmail: string;
    resourceType: string;
    resourceId: string;
    changes?: string;
    previousHash: string;
    entryHash: string;
    createdAt: string;
}
