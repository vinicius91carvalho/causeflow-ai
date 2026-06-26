import type { TenantId, AuditEntryId } from '../../../shared/domain/value-objects.js';
import type { AuditAction } from '../../../shared/domain/types.js';
export type AuditActorType = 'user' | 'system' | 'agent';

/**
 * Lightweight audit-specific evidence type.
 * Intentionally minimal — does NOT reuse the triage-bounded Evidence type
 * (which carries tenantId/incidentId/evidenceId belonging to a different domain).
 */
export interface AuditEvidence {
  type: string;
  content: string;
  source?: string;
}

export interface AuditEntry {
    tenantId: TenantId;
    entryId: AuditEntryId;
    action: AuditAction;
    actorType: AuditActorType;
    /**
     * Canonical actor identity — JWT `sub` (stable, opaque) when known.
     * Absent for system-initiated events (background jobs, webhooks, auto-remediation).
     * NOT included in `entryHash` input so pseudonymization can mutate it without
     * breaking the hash chain (see docs/compliance/audit-retention-policy.md).
     */
    actorUserId?: string;
    actorEmail: string;
    resourceType: string;
    resourceId: string;
    changes?: string;
    /**
     * Optional array of evidence items attached to this audit entry.
     * Currently populated for `investigation.completed` events.
     * Additive optional field — absent on legacy rows.
     */
    evidences?: AuditEvidence[];
    previousHash: string;
    entryHash: string;
    createdAt: string;
    /**
     * ISO timestamp when this row's actor was pseudonymized (LGPD/GDPR erasure).
     * When set, `actorUserId` holds the erasure marker rather than the original sub.
     */
    pseudonymizedAt?: string;
}
