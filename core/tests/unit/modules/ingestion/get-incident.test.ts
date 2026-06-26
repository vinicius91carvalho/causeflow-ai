import { describe, it, expect, vi } from 'vitest';
import { GetIncidentUseCase } from '../../../../src/modules/ingestion/application/get-incident.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import { IncidentNotFoundError } from '../../../../src/modules/ingestion/domain/incident.errors.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

describe('GetIncidentUseCase', () => {
  it('should return incident when found', async () => {
    const mockIncident = { incidentId: 'inc-1', tenantId: 'tenant-1', title: 'Test' } as Incident;
    const repo: IIncidentRepository = {
      create: vi.fn(),
      findById: vi.fn(async () => mockIncident),
      findBySourceAlert: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      listByTenant: vi.fn(),
      findBySeverity: vi.fn(),
      findByStatus: vi.fn(),
      listByCreatedAt: vi.fn(),
      findAll: vi.fn(),
    };

    const useCase = new GetIncidentUseCase(repo);
    const result = await useCase.execute(tenantId('tenant-1'), incidentId('inc-1'));

    expect(result).toBe(mockIncident);
  });

  it('should throw IncidentNotFoundError when not found', async () => {
    const repo: IIncidentRepository = {
      create: vi.fn(),
      findById: vi.fn(async () => null),
      findBySourceAlert: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      listByTenant: vi.fn(),
      findBySeverity: vi.fn(),
      findByStatus: vi.fn(),
      listByCreatedAt: vi.fn(),
      findAll: vi.fn(),
    };

    const useCase = new GetIncidentUseCase(repo);

    await expect(
      useCase.execute(tenantId('tenant-1'), incidentId('nonexistent')),
    ).rejects.toThrow(IncidentNotFoundError);
  });
});
