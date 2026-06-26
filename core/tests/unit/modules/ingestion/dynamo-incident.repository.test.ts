import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

const mockEntity = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  query: {
    primary: vi.fn(),
    bySeverityStatus: vi.fn(),
    byCreatedAt: vi.fn(),
    bySourceAlert: vi.fn(),
  },
  patch: vi.fn(),
}));

vi.mock('../../../../src/shared/infra/db/entities/IncidentEntity.js', () => ({
  IncidentEntity: mockEntity,
}));

import { DynamoIncidentRepository } from '../../../../src/modules/ingestion/infra/dynamo-incident.repository.js';

const sampleIncidentData = {
  incidentId: 'inc-1',
  tenantId: 'tenant-1',
  title: 'CPU Spike',
  description: 'CPU at 95%',
  severity: 'critical',
  status: 'open',
  sourceProvider: 'datadog',
  sourceAlertId: 'dd-123',
  assignedAgents: undefined,
  rootCause: undefined,
  resolution: undefined,
  resolvedAt: undefined,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('DynamoIncidentRepository', () => {
  let repo: DynamoIncidentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DynamoIncidentRepository();
  });

  it('create() should call IncidentEntity.create and return domain object', async () => {
    mockEntity.create.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: sampleIncidentData }),
    });

    const incident = {
      incidentId: incidentId('inc-1'),
      tenantId: tenantId('tenant-1'),
      title: 'CPU Spike',
      description: 'CPU at 95%',
      severity: 'critical' as const,
      status: 'open' as const,
      sourceProvider: 'datadog',
      sourceAlertId: 'dd-123',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = await repo.create(incident);

    expect(mockEntity.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      incidentId: 'inc-1',
      title: 'CPU Spike',
      description: 'CPU at 95%',
      severity: 'critical',
      status: 'open',
      sourceProvider: 'datadog',
      sourceAlertId: 'dd-123',
      assignedAgents: undefined,
    });
    expect(result.incidentId).toBe('inc-1');
    expect(result.title).toBe('CPU Spike');
    expect(result.severity).toBe('critical');
  });

  it('findById() should return domain object when found', async () => {
    mockEntity.get.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: sampleIncidentData }),
    });

    const result = await repo.findById(tenantId('tenant-1'), incidentId('inc-1'));

    expect(mockEntity.get).toHaveBeenCalledWith({ tenantId: 'tenant-1', incidentId: 'inc-1' });
    expect(result).not.toBeNull();
    expect(result!.incidentId).toBe('inc-1');
    expect(result!.status).toBe('open');
  });

  it('findById() should return null when not found', async () => {
    mockEntity.get.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: null }),
    });

    const result = await repo.findById(tenantId('tenant-1'), incidentId('nonexistent'));

    expect(mockEntity.get).toHaveBeenCalledWith({ tenantId: 'tenant-1', incidentId: 'nonexistent' });
    expect(result).toBeNull();
  });

  it('findBySourceAlert() should call query.bySourceAlert and return first match', async () => {
    mockEntity.query.bySourceAlert.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: [sampleIncidentData] }),
    });

    const result = await repo.findBySourceAlert(tenantId('tenant-1'), 'datadog', 'dd-123');

    expect(mockEntity.query.bySourceAlert).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      sourceProvider: 'datadog',
      sourceAlertId: 'dd-123',
    });
    expect(result).not.toBeNull();
    expect(result!.sourceAlertId).toBe('dd-123');
  });

  it('findBySourceAlert() should return null when no match', async () => {
    mockEntity.query.bySourceAlert.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: [] }),
    });

    const result = await repo.findBySourceAlert(tenantId('tenant-1'), 'datadog', 'unknown');

    expect(result).toBeNull();
  });

  it('update() should call patch().set().go() and return updated domain object', async () => {
    const updatedData = { ...sampleIncidentData, title: 'CPU Spike (updated)' };
    const mockSetGo = vi.fn().mockResolvedValue({ data: updatedData });
    const mockSet = vi.fn().mockReturnValue({ go: mockSetGo });
    mockEntity.patch.mockReturnValue({ set: mockSet });

    const result = await repo.update(tenantId('tenant-1'), incidentId('inc-1'), {
      title: 'CPU Spike (updated)',
    });

    expect(mockEntity.patch).toHaveBeenCalledWith({ tenantId: 'tenant-1', incidentId: 'inc-1' });
    expect(mockSet).toHaveBeenCalledWith({ title: 'CPU Spike (updated)' });
    expect(mockSetGo).toHaveBeenCalledWith({ response: 'all_new' });
    expect(result.title).toBe('CPU Spike (updated)');
  });

  it('updateStatus() should call patch().set().go() with status and optional resolvedAt', async () => {
    const updatedData = { ...sampleIncidentData, status: 'resolved', resolvedAt: '2024-01-02T00:00:00Z' };
    const mockSetGo = vi.fn().mockResolvedValue({ data: updatedData });
    const mockSet = vi.fn().mockReturnValue({ go: mockSetGo });
    mockEntity.patch.mockReturnValue({ set: mockSet });

    const result = await repo.updateStatus(
      tenantId('tenant-1'),
      incidentId('inc-1'),
      'resolved',
      '2024-01-02T00:00:00Z',
    );

    expect(mockEntity.patch).toHaveBeenCalledWith({ tenantId: 'tenant-1', incidentId: 'inc-1' });
    expect(mockSet).toHaveBeenCalledWith({ status: 'resolved', resolvedAt: '2024-01-02T00:00:00Z' });
    expect(mockSetGo).toHaveBeenCalledWith({ response: 'all_new' });
    expect(result.status).toBe('resolved');
  });

  it('listByTenant() should call query.primary and return paginated result', async () => {
    mockEntity.query.primary.mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [sampleIncidentData],
        cursor: 'next-page',
      }),
    });

    const result = await repo.listByTenant(tenantId('tenant-1'), { limit: 5 });

    expect(mockEntity.query.primary).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.incidentId).toBe('inc-1');
    expect(result.cursor).toBe('next-page');
  });

  it('findBySeverity() should call query.bySeverityStatus with severity only', async () => {
    mockEntity.query.bySeverityStatus.mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [sampleIncidentData],
        cursor: null,
      }),
    });

    const result = await repo.findBySeverity(tenantId('tenant-1'), 'critical');

    expect(mockEntity.query.bySeverityStatus).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      severity: 'critical',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.severity).toBe('critical');
  });

  it('findByStatus() should call query.bySeverityStatus with severity and status', async () => {
    mockEntity.query.bySeverityStatus.mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [sampleIncidentData],
        cursor: null,
      }),
    });

    const result = await repo.findByStatus(tenantId('tenant-1'), 'critical', 'open');

    expect(mockEntity.query.bySeverityStatus).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      severity: 'critical',
      status: 'open',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.status).toBe('open');
  });

  it('listByCreatedAt() should call query.byCreatedAt and return paginated result', async () => {
    mockEntity.query.byCreatedAt.mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [sampleIncidentData],
        cursor: null,
      }),
    });

    const result = await repo.listByCreatedAt(tenantId('tenant-1'), { order: 'desc' });

    expect(mockEntity.query.byCreatedAt).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.createdAt).toBe('2024-01-01T00:00:00Z');
  });
});
