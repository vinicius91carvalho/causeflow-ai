import { describe, it, expect, vi } from 'vitest';
import { ListIncidentsUseCase } from '../../../../src/modules/ingestion/application/list-incidents.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

describe('ListIncidentsUseCase', () => {
  it('should list incidents for a tenant', async () => {
    const incidents = [
      { incidentId: 'inc-1', title: 'Alert 1' },
      { incidentId: 'inc-2', title: 'Alert 2' },
    ] as Incident[];

    const repo: IIncidentRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySourceAlert: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      listByTenant: vi.fn(async () => ({ items: incidents, cursor: undefined })),
      findBySeverity: vi.fn(),
      findByStatus: vi.fn(),
      listByCreatedAt: vi.fn(),
      findAll: vi.fn(),
    };

    const useCase = new ListIncidentsUseCase(repo);
    const result = await useCase.execute({ tenantId: tenantId('tenant-1') });

    expect(result.items).toHaveLength(2);
    expect(repo.listByTenant).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      { limit: 20, cursor: undefined },
    );
  });

  it('should use default limit of 20', async () => {
    const repo: IIncidentRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySourceAlert: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      listByTenant: vi.fn(async () => ({ items: [], cursor: undefined })),
      findBySeverity: vi.fn(),
      findByStatus: vi.fn(),
      listByCreatedAt: vi.fn(),
      findAll: vi.fn(),
    };

    const useCase = new ListIncidentsUseCase(repo);
    await useCase.execute({ tenantId: tenantId('tenant-1') });

    expect(repo.listByTenant).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      { limit: 20, cursor: undefined },
    );
  });
});
