/**
 * Unit tests for audit handler actor resolution logic.
 *
 * These tests exercise the exported helpers from
 * `src/modules/audit/application/resolve-actor.ts`, which are the SAME
 * functions called by the bootstrap.ts audit subscriptions.  A regression in
 * either helper (e.g. reverting to hardcoded 'system') causes the
 * corresponding tests here to fail.
 *
 * AC-2: each audit handler reads user identity from event payload defensively,
 * falling back to "system" when the field is absent.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveIncidentCreatedActor,
  resolveIncidentStatusChangedActor,
  resolveInvestigationCompletedActor,
  extractEvidencesFromPayload,
  resolveTenantActor,
  resolveRemediationActor,
  resolveRemediationApprovedActor,
  resolveRemediationRejectedActor,
  resolveApiKeyCreatedActor,
  resolveApiKeyRevokedActor,
} from '../../../../src/modules/audit/application/resolve-actor.js';

// ---------------------------------------------------------------------------
// incident.created
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: incident.created', () => {
  it('resolves user actor when actorUserId is present', () => {
    const result = resolveIncidentCreatedActor({
      actorUserId: 'user-abc',
      actorEmail: 'alice@example.com',
    });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('alice@example.com');
    expect(result.actorUserId).toBe('user-abc');
  });

  it('falls back to system when actorUserId is absent', () => {
    const result = resolveIncidentCreatedActor({});
    expect(result.actorType).toBe('system');
    expect(result.actorEmail).toBe('system@causeflow.ai');
    expect(result.actorUserId).toBeUndefined();
  });

  it('uses legacyCreatedBy as email fallback when actorEmail is missing', () => {
    const result = resolveIncidentCreatedActor({
      actorUserId: 'user-abc',
      createdBy: 'legacy@example.com',
    });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('legacy@example.com');
  });

  it('prefers actorEmail over legacyCreatedBy when both present', () => {
    const result = resolveIncidentCreatedActor({
      actorUserId: 'user-abc',
      actorEmail: 'primary@example.com',
      createdBy: 'legacy@example.com',
    });
    expect(result.actorEmail).toBe('primary@example.com');
  });
});

// ---------------------------------------------------------------------------
// incident.status_changed
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: incident.status_changed', () => {
  it('resolves user actor when actorUserId is present', () => {
    const result = resolveIncidentStatusChangedActor({
      actorUserId: 'user-xyz',
      actorEmail: 'bob@example.com',
    });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('bob@example.com');
  });

  it('falls back to system when actorUserId is absent', () => {
    const result = resolveIncidentStatusChangedActor({});
    expect(result.actorType).toBe('system');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });

  it('uses system email when actorUserId present but actorEmail missing', () => {
    const result = resolveIncidentStatusChangedActor({ actorUserId: 'user-xyz' });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });
});

// ---------------------------------------------------------------------------
// investigation.completed
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: investigation.completed', () => {
  it('resolves user actor when triggeredBy is present', () => {
    const result = resolveInvestigationCompletedActor({ triggeredBy: 'carol@example.com' });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('carol@example.com');
  });

  it('falls back to system when triggeredBy is absent', () => {
    const result = resolveInvestigationCompletedActor({});
    expect(result.actorType).toBe('system');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });

  it('extracts evidences array from payload when present', () => {
    const rawEvidences = [
      { type: 'log', content: 'CPU spike at 99%', source: 'cloudwatch' },
      { type: 'metric', content: 'p99=3200ms' },
    ];
    const evidences = extractEvidencesFromPayload({ evidences: rawEvidences });
    expect(evidences).toHaveLength(2);
    expect(evidences![0]).toEqual({ type: 'log', content: 'CPU spike at 99%', source: 'cloudwatch' });
    expect(evidences![1]).toEqual({ type: 'metric', content: 'p99=3200ms' });
    expect('source' in evidences![1]!).toBe(false);
  });

  it('returns undefined evidences when payload has no evidences field', () => {
    const evidences = extractEvidencesFromPayload({});
    expect(evidences).toBeUndefined();
  });

  it('returns undefined evidences when payload evidences field is not an array', () => {
    const evidences = extractEvidencesFromPayload({ evidences: 'not-an-array' });
    expect(evidences).toBeUndefined();
  });

  it('coerces non-string type/content fields to strings defensively', () => {
    // null ?? '' → '' (nullish coalescing before String()), then String('') → ''
    // non-null non-string: 42 ?? '' → 42, then String(42) → '42'
    const rawEvidences = [{ type: 42, content: null }];
    const evidences = extractEvidencesFromPayload({ evidences: rawEvidences });
    expect(evidences![0]!.type).toBe('42');
    // null ?? '' produces '' before String(), so content becomes ''
    expect(evidences![0]!.content).toBe('');
  });
});

// ---------------------------------------------------------------------------
// tenant.created
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: tenant.created', () => {
  it('resolves user actor when actorUserId is present', () => {
    const result = resolveTenantActor({
      actorUserId: 'admin-1',
      actorEmail: 'admin@corp.com',
    });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('admin@corp.com');
  });

  it('falls back to system when actorUserId is absent', () => {
    const result = resolveTenantActor({});
    expect(result.actorType).toBe('system');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });
});

// ---------------------------------------------------------------------------
// tenant.updated
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: tenant.updated', () => {
  it('resolves user actor when actorUserId is present', () => {
    const result = resolveTenantActor({
      actorUserId: 'admin-2',
      actorEmail: 'admin@corp.com',
    });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('admin@corp.com');
  });

  it('falls back to system when actorUserId is absent', () => {
    const result = resolveTenantActor({});
    expect(result.actorType).toBe('system');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });
});

// ---------------------------------------------------------------------------
// remediation.proposed
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: remediation.proposed', () => {
  it('resolves user actor when actorUserId is present', () => {
    const result = resolveRemediationActor({
      actorUserId: 'user-rem',
      actorEmail: 'engineer@example.com',
    });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('engineer@example.com');
  });

  it('falls back to system when actorUserId is absent', () => {
    const result = resolveRemediationActor({});
    expect(result.actorType).toBe('system');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });
});

// ---------------------------------------------------------------------------
// remediation.executed
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: remediation.executed', () => {
  it('resolves user actor when actorUserId is present', () => {
    const result = resolveRemediationActor({
      actorUserId: 'user-exec',
      actorEmail: 'ops@example.com',
    });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('ops@example.com');
  });

  it('falls back to system when actorUserId is absent', () => {
    const result = resolveRemediationActor({});
    expect(result.actorType).toBe('system');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });
});

// ---------------------------------------------------------------------------
// remediation.approved
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: remediation.approved', () => {
  it('always uses user actor type with approvedBy email', () => {
    const result = resolveRemediationApprovedActor({ approvedBy: 'manager@example.com' });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('manager@example.com');
  });

  it('falls back to system email when approvedBy is absent', () => {
    const result = resolveRemediationApprovedActor({});
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });
});

// ---------------------------------------------------------------------------
// remediation.rejected
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: remediation.rejected', () => {
  it('always uses user actor type with rejectedBy email', () => {
    const result = resolveRemediationRejectedActor({ rejectedBy: 'reviewer@example.com' });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('reviewer@example.com');
  });

  it('falls back to system email when rejectedBy is absent', () => {
    const result = resolveRemediationRejectedActor({});
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });
});

// ---------------------------------------------------------------------------
// apikey.created
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: apikey.created', () => {
  it('resolves user actor when createdBy is present', () => {
    const result = resolveApiKeyCreatedActor({ createdBy: 'dev@example.com' });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('dev@example.com');
  });

  it('falls back to system when createdBy is absent', () => {
    const result = resolveApiKeyCreatedActor({});
    expect(result.actorType).toBe('system');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });
});

// ---------------------------------------------------------------------------
// apikey.revoked
// ---------------------------------------------------------------------------
describe('bootstrap actor resolution: apikey.revoked', () => {
  it('resolves user actor when revokedBy is present', () => {
    const result = resolveApiKeyRevokedActor({ revokedBy: 'admin@example.com' });
    expect(result.actorType).toBe('user');
    expect(result.actorEmail).toBe('admin@example.com');
  });

  it('falls back to system when revokedBy is absent', () => {
    const result = resolveApiKeyRevokedActor({});
    expect(result.actorType).toBe('system');
    expect(result.actorEmail).toBe('system@causeflow.ai');
  });
});
