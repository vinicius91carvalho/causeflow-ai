import { describe, expect, it } from 'vitest';
import { type AuditEntry, type AuditEvidence, VALID_ACTIONS, type ValidAction } from './types';

describe('audit/domain/types', () => {
  describe('VALID_ACTIONS', () => {
    it('contains the original user-emitted actions for backwards compatibility', () => {
      expect(VALID_ACTIONS).toContain('incident.created');
      expect(VALID_ACTIONS).toContain('incident.status_changed');
      expect(VALID_ACTIONS).toContain('remediation.proposed');
      expect(VALID_ACTIONS).toContain('remediation.approved');
      expect(VALID_ACTIONS).toContain('remediation.rejected');
      expect(VALID_ACTIONS).toContain('remediation.executed');
      expect(VALID_ACTIONS).toContain('approval.responded');
    });

    it('contains the investigation lifecycle actions', () => {
      expect(VALID_ACTIONS).toContain('investigation.started');
      expect(VALID_ACTIONS).toContain('investigation.completed');
      expect(VALID_ACTIONS).toContain('investigation.aborted');
      expect(VALID_ACTIONS).toContain('investigation.failed');
    });

    it('contains the agent step actions', () => {
      expect(VALID_ACTIONS).toContain('agent.started');
      expect(VALID_ACTIONS).toContain('agent.evidence_appended');
      expect(VALID_ACTIONS).toContain('agent.completed');
    });

    it('exposes a typed alias compatible with VALID_ACTIONS', () => {
      const action: ValidAction = 'agent.started';
      expect(VALID_ACTIONS).toContain(action);
    });
  });

  describe('AuditEntry interface', () => {
    it('accepts a minimal user entry', () => {
      const entry: AuditEntry = {
        tenantId: 't1',
        entryId: 'e1',
        action: 'incident.created',
        actorType: 'user',
        actorEmail: 'alice@example.com',
        resourceType: 'incident',
        resourceId: 'inc-1',
        entryHash: 'abc',
        createdAt: '2026-04-14T00:00:00Z',
      };
      expect(entry.actorUserId).toBeUndefined();
    });

    it('accepts a system entry', () => {
      const entry: AuditEntry = {
        tenantId: 't1',
        entryId: 'e2',
        action: 'agent.started',
        actorType: 'system',
        actorEmail: '',
        resourceType: 'incident',
        resourceId: 'inc-1',
        entryHash: 'def',
        createdAt: '2026-04-14T01:00:00Z',
      };
      expect(entry.actorType).toBe('system');
    });

    it('accepts an entry with optional actorUserId', () => {
      const entry: AuditEntry = {
        tenantId: 't1',
        entryId: 'e3',
        action: 'remediation.proposed',
        actorType: 'user',
        actorUserId: 'user_clerk_abc',
        actorEmail: 'bob@example.com',
        resourceType: 'incident',
        resourceId: 'inc-2',
        entryHash: 'ghi',
        createdAt: '2026-04-14T02:00:00Z',
      };
      expect(entry.actorUserId).toBe('user_clerk_abc');
    });

    it('accepts an entry with actorName and actorId for the display fallback chain', () => {
      const entry: AuditEntry = {
        tenantId: 't1',
        entryId: 'e4',
        action: 'incident.status_changed',
        actorType: 'user',
        actorEmail: '',
        actorName: 'Alice Smith',
        actorId: 'user_clerk_xyz',
        resourceType: 'incident',
        resourceId: 'inc-3',
        entryHash: 'jkl',
        createdAt: '2026-04-14T03:00:00Z',
      };
      expect(entry.actorName).toBe('Alice Smith');
      expect(entry.actorId).toBe('user_clerk_xyz');
    });

    it('accepts an entry with an evidences array', () => {
      const entry: AuditEntry = {
        tenantId: 't1',
        entryId: 'e5',
        action: 'investigation.completed',
        actorType: 'system',
        actorEmail: '',
        resourceType: 'incident',
        resourceId: 'inc-4',
        entryHash: 'mno',
        createdAt: '2026-04-14T04:00:00Z',
        evidences: [
          { type: 'log', content: 'Error spike at 14:00 UTC' },
          { type: 'metric', content: 'CPU 99%', source: 'datadog' },
        ],
      };
      expect(entry.evidences).toHaveLength(2);
      expect(entry.evidences?.[0].type).toBe('log');
      expect(entry.evidences?.[1].source).toBe('datadog');
    });

    it('accepts an entry without evidences (optional field)', () => {
      const entry: AuditEntry = {
        tenantId: 't1',
        entryId: 'e6',
        action: 'agent.started',
        actorType: 'system',
        actorEmail: '',
        resourceType: 'incident',
        resourceId: 'inc-5',
        entryHash: 'pqr',
        createdAt: '2026-04-14T05:00:00Z',
      };
      expect(entry.evidences).toBeUndefined();
    });
  });

  describe('AuditEvidence interface', () => {
    it('accepts a minimal evidence with type and content only', () => {
      const ev: AuditEvidence = { type: 'log', content: 'timeout after 30s' };
      expect(ev.type).toBe('log');
      expect(ev.content).toBe('timeout after 30s');
      expect(ev.source).toBeUndefined();
    });

    it('accepts an evidence with an optional source', () => {
      const ev: AuditEvidence = { type: 'metric', content: 'p99 latency 2s', source: 'datadog' };
      expect(ev.source).toBe('datadog');
    });
  });
});
