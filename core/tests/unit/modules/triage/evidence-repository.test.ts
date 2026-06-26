import { describe, it, expect, vi } from 'vitest';
import type { IEvidenceRepository, Evidence } from '../../../../src/modules/triage/domain/evidence.repository.js';
import { tenantId, incidentId, evidenceId } from '../../../../src/shared/domain/value-objects.js';

function createMockEvidenceRepo(): IEvidenceRepository {
  const store: Evidence[] = [];
  return {
    create: vi.fn(async (evidence: Evidence) => {
      store.push(evidence);
      return evidence;
    }),
    findByIncident: vi.fn(async (tid, iid) =>
      store.filter((e) => e.tenantId === tid && e.incidentId === iid),
    ),
    listByAgentRole: vi.fn(async (iid, role) =>
      store.filter((e) => e.incidentId === iid && e.agentRole === role),
    ),
  };
}

function createTestEvidence(overrides?: Partial<Evidence>): Evidence {
  return {
    tenantId: tenantId('tenant-1'),
    incidentId: incidentId('inc-123'),
    evidenceId: evidenceId('ev-001'),
    agentRole: 'coordinator',
    evidenceType: 'agent_reasoning',
    content: 'Analysis indicates memory leak in service',
    metadata: { confidence: 0.9 },
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('IEvidenceRepository (mock)', () => {
  it('should create and retrieve evidence', async () => {
    const repo = createMockEvidenceRepo();
    const evidence = createTestEvidence();

    const created = await repo.create(evidence);
    expect(created).toEqual(evidence);
    expect(repo.create).toHaveBeenCalledTimes(1);

    const found = await repo.findByIncident(tenantId('tenant-1'), incidentId('inc-123'));
    expect(found).toHaveLength(1);
    expect(found[0]?.content).toBe('Analysis indicates memory leak in service');
  });

  it('should filter by agent role', async () => {
    const repo = createMockEvidenceRepo();

    await repo.create(createTestEvidence({ agentRole: 'coordinator', evidenceId: evidenceId('ev-001') }));
    await repo.create(createTestEvidence({ agentRole: 'log_analyst', evidenceId: evidenceId('ev-002'), content: 'Log error found' }));

    const coordinatorEvidence = await repo.listByAgentRole(incidentId('inc-123'), 'coordinator');
    expect(coordinatorEvidence).toHaveLength(1);
    expect(coordinatorEvidence[0]?.agentRole).toBe('coordinator');

    const logEvidence = await repo.listByAgentRole(incidentId('inc-123'), 'log_analyst');
    expect(logEvidence).toHaveLength(1);
    expect(logEvidence[0]?.content).toBe('Log error found');
  });

  it('should return empty array when no evidence exists', async () => {
    const repo = createMockEvidenceRepo();

    const found = await repo.findByIncident(tenantId('tenant-1'), incidentId('inc-999'));
    expect(found).toEqual([]);
  });
});
