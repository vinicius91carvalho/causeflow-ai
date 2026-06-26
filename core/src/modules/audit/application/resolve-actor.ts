/**
 * Actor resolution helpers for audit trail event handlers.
 *
 * Pure TypeScript — no SDK or infra imports. Each function extracts actor
 * identity from an event payload using the same defensive logic that lives in
 * the bootstrap.ts audit subscriptions.  Extracting them here lets unit tests
 * import and exercise the REAL production code rather than maintaining parallel
 * inline copies inside the test file.
 *
 * Dependency direction: bootstrap.ts (infra/composition root) → this file
 * (application layer).  Allowed per the Infra → Application → Domain rule.
 */

export type ActorType = 'user' | 'system';

export interface ResolvedActor {
  actorType: ActorType;
  actorEmail: string;
  actorUserId?: string;
}

const SYSTEM_EMAIL = 'system@causeflow.ai';

/**
 * incident.created
 * Uses `actorUserId` + `actorEmail`.  Accepts `createdBy` as a legacy email
 * fallback for one deploy cycle (pre-threading rows).
 */
export function resolveIncidentCreatedActor(
  payload: Record<string, unknown>,
): ResolvedActor {
  const actorUserId = payload['actorUserId'] as string | undefined;
  const actorEmail = payload['actorEmail'] as string | undefined;
  const legacyCreatedBy = payload['createdBy'] as string | undefined;
  const effectiveEmail = actorEmail ?? legacyCreatedBy;
  return {
    actorType: actorUserId ? 'user' : 'system',
    actorEmail: actorUserId ? (effectiveEmail ?? SYSTEM_EMAIL) : SYSTEM_EMAIL,
    ...(actorUserId ? { actorUserId } : {}),
  };
}

/**
 * incident.status_changed
 * Uses `actorUserId` + `actorEmail`.
 */
export function resolveIncidentStatusChangedActor(
  payload: Record<string, unknown>,
): ResolvedActor {
  const actorUserId = payload['actorUserId'] as string | undefined;
  const actorEmail = payload['actorEmail'] as string | undefined;
  return {
    actorType: actorUserId ? 'user' : 'system',
    actorEmail: actorUserId ? (actorEmail ?? SYSTEM_EMAIL) : SYSTEM_EMAIL,
    ...(actorUserId ? { actorUserId } : {}),
  };
}

/**
 * investigation.completed
 * Uses `triggeredBy` (email of the requesting user).
 */
export function resolveInvestigationCompletedActor(
  payload: Record<string, unknown>,
): ResolvedActor {
  const triggeredBy = payload['triggeredBy'] as string | undefined;
  return {
    actorType: triggeredBy ? 'user' : 'system',
    actorEmail: triggeredBy ?? SYSTEM_EMAIL,
  };
}

/**
 * investigation.completed — evidences extraction
 * Defensively maps the evidences array from the payload, coercing each field
 * to string.  Returns undefined when the field is absent or not an array.
 */
export function extractEvidencesFromPayload(
  payload: Record<string, unknown>,
): Array<{ type: string; content: string; source?: string }> | undefined {
  const rawEvidences = payload['evidences'];
  if (!Array.isArray(rawEvidences)) return undefined;
  return (rawEvidences as Array<{ type: unknown; content: unknown; source?: unknown }>).map(
    (e) => ({
      type: toPrimitiveString(e.type),
      content: toPrimitiveString(e.content),
      ...(e.source !== undefined && { source: toPrimitiveString(e.source) }),
    }),
  );
}

function toPrimitiveString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

/**
 * tenant.created / tenant.updated
 * Uses `actorUserId` + `actorEmail`.
 */
export function resolveTenantActor(payload: Record<string, unknown>): ResolvedActor {
  const actorUserId = payload['actorUserId'] as string | undefined;
  const actorEmail = payload['actorEmail'] as string | undefined;
  return {
    actorType: actorUserId ? 'user' : 'system',
    actorEmail: actorUserId ? (actorEmail ?? SYSTEM_EMAIL) : SYSTEM_EMAIL,
    ...(actorUserId ? { actorUserId } : {}),
  };
}

/**
 * remediation.proposed / remediation.executed
 * Uses `actorUserId` + `actorEmail`.
 */
export function resolveRemediationActor(payload: Record<string, unknown>): ResolvedActor {
  const actorUserId = payload['actorUserId'] as string | undefined;
  const actorEmail = payload['actorEmail'] as string | undefined;
  return {
    actorType: actorUserId ? 'user' : 'system',
    actorEmail: actorUserId ? (actorEmail ?? SYSTEM_EMAIL) : SYSTEM_EMAIL,
    ...(actorUserId ? { actorUserId } : {}),
  };
}

/**
 * remediation.approved
 * Always `user` actor; email sourced from `approvedBy`.
 */
export function resolveRemediationApprovedActor(
  payload: Record<string, unknown>,
): ResolvedActor {
  return {
    actorType: 'user',
    actorEmail: (payload['approvedBy'] as string | undefined) ?? SYSTEM_EMAIL,
  };
}

/**
 * remediation.rejected
 * Always `user` actor; email sourced from `rejectedBy`.
 */
export function resolveRemediationRejectedActor(
  payload: Record<string, unknown>,
): ResolvedActor {
  return {
    actorType: 'user',
    actorEmail: (payload['rejectedBy'] as string | undefined) ?? SYSTEM_EMAIL,
  };
}

/**
 * apikey.created
 * Uses `createdBy` (email of the user who created the key).
 */
export function resolveApiKeyCreatedActor(payload: Record<string, unknown>): ResolvedActor {
  const createdBy = payload['createdBy'] as string | undefined;
  return {
    actorType: createdBy ? 'user' : 'system',
    actorEmail: createdBy ?? SYSTEM_EMAIL,
  };
}

/**
 * apikey.revoked
 * Uses `revokedBy` (email of the user who revoked the key).
 */
export function resolveApiKeyRevokedActor(payload: Record<string, unknown>): ResolvedActor {
  const revokedBy = payload['revokedBy'] as string | undefined;
  return {
    actorType: revokedBy ? 'user' : 'system',
    actorEmail: revokedBy ?? SYSTEM_EMAIL,
  };
}
