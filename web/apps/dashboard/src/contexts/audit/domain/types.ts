/**
 * Audit domain types.
 */

/**
 * A single piece of evidence attached to an audit entry.
 * Mirrors the core backend shape: { type, content, source? }.
 * Defined here to avoid cross-repo type coupling (web mirrors, never imports from core).
 */
export interface AuditEvidence {
  type: string;
  content: string;
  source?: string;
}

export interface AuditEntry {
  tenantId: string;
  entryId: string;
  action: string;
  actorType: 'user' | 'system';
  actorUserId?: string;
  actorEmail: string;
  /** Display name of the actor. Falls back chain: actorEmail → actorName → actorId. */
  actorName?: string;
  /** Stable ID of the actor (clerk user id, etc.). Used as last-resort display fallback. */
  actorId?: string;
  resourceType: string;
  resourceId: string;
  changes?: string;
  previousHash?: string;
  entryHash: string;
  createdAt: string;
  /**
   * Optional evidences attached to the audit entry (e.g. investigation.completed).
   * Hidden in the UI when undefined or empty.
   */
  evidences?: AuditEvidence[];
}

/**
 * All valid audit action types.
 * Used for filtering in API handlers and UI components.
 *
 * The list contains both **user-emitted** actions (operators / admins acting
 * via the dashboard) and **agent / system-emitted** actions (recorded during
 * an investigation by the upstream agents). Both sets pass through the BFF
 * allowlist filter together.
 */
export const VALID_ACTIONS = [
  // User-emitted actions (operator, admin)
  'incident.created',
  'incident.status_changed',
  'remediation.proposed',
  'remediation.approved',
  'remediation.rejected',
  'remediation.executed',
  'approval.responded',
  // Agent / system-emitted actions (during investigation)
  'investigation.started',
  'investigation.completed',
  'investigation.aborted',
  'investigation.failed',
  'agent.started',
  'agent.evidence_appended',
  'agent.completed',
] as const;

export type ValidAction = (typeof VALID_ACTIONS)[number];
