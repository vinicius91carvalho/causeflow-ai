import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

const mockEntity = vi.hoisted(() => ({
  create: vi.fn(),
  query: {
    primary: vi.fn(),
    byAgentRole: vi.fn(),
  },
}));

vi.mock('../../../../src/shared/infra/db/entities/EvidenceEntity.js', () => ({
  EvidenceEntity: mockEntity,
}));

import { DynamoEvidenceRepository } from '../../../../src/modules/triage/infra/dynamo-evidence.repository.js';

const sampleEvidenceData = {
  tenantId: 'tenant-1',
  incidentId: 'inc-1',
  evidenceId: 'ev-1',
  agentRole: 'log_analyst',
  evidenceType: 'log_snippet',
  content: 'Error detected in service logs',
  metadata: { confidence: 0.85 },
  createdAt: '2024-01-01T00:00:00Z',
};

describe('DynamoEvidenceRepository', () => {
  let repo: DynamoEvidenceRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DynamoEvidenceRepository();
  });

  it('create() should call EvidenceEntity.create and return domain object', async () => {
    mockEntity.create.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: sampleEvidenceData }),
    });

    const evidence = {
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      evidenceId: 'ev-1' as any,
      agentRole: 'log_analyst' as const,
      evidenceType: 'log_snippet' as const,
      content: 'Error detected in service logs',
      metadata: { confidence: 0.85 },
      createdAt: '2024-01-01T00:00:00Z',
    };

    const result = await repo.create(evidence);

    expect(mockEntity.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      incidentId: 'inc-1',
      evidenceId: 'ev-1',
      agentRole: 'log_analyst',
      evidenceType: 'log_snippet',
      content: 'Error detected in service logs',
      metadata: { confidence: 0.85 },
    });
    expect(result.evidenceId).toBe('ev-1');
    expect(result.agentRole).toBe('log_analyst');
    expect(result.content).toBe('Error detected in service logs');
  });

  it('findByIncident() should call query.primary with where clause and return results', async () => {
    const mockGo = vi.fn().mockResolvedValue({ data: [sampleEvidenceData] });
    const mockWhere = vi.fn().mockReturnValue({ go: mockGo });
    mockEntity.query.primary.mockReturnValue({ where: mockWhere });

    const result = await repo.findByIncident(tenantId('tenant-1'), incidentId('inc-1'));

    expect(mockEntity.query.primary).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(mockWhere).toHaveBeenCalledWith(expect.any(Function));
    expect(result).toHaveLength(1);
    expect(result[0]!.incidentId).toBe('inc-1');
    expect(result[0]!.evidenceType).toBe('log_snippet');
  });

  it('findByIncident() should return empty array when no evidence found', async () => {
    const mockGo = vi.fn().mockResolvedValue({ data: [] });
    const mockWhere = vi.fn().mockReturnValue({ go: mockGo });
    mockEntity.query.primary.mockReturnValue({ where: mockWhere });

    const result = await repo.findByIncident(tenantId('tenant-1'), incidentId('inc-999'));

    expect(result).toEqual([]);
  });

  it('listByAgentRole() should call query.byAgentRole and return results', async () => {
    mockEntity.query.byAgentRole.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: [sampleEvidenceData] }),
    });

    const result = await repo.listByAgentRole(incidentId('inc-1'), 'log_analyst');

    expect(mockEntity.query.byAgentRole).toHaveBeenCalledWith({
      incidentId: 'inc-1',
      agentRole: 'log_analyst',
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.agentRole).toBe('log_analyst');
  });
});
