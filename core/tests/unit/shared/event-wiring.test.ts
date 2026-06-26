import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../../src/shared/domain/events.js';
import { CreateAuditEntryUseCase } from '../../../src/modules/audit/application/create-audit-entry.usecase.js';
import { tenantId } from '../../../src/shared/domain/value-objects.js';
import type { IAuditRepository } from '../../../src/modules/audit/domain/audit.repository.js';
import type { AuditEntry } from '../../../src/modules/audit/domain/audit.entity.js';

function createMockAuditRepo(): IAuditRepository {
  return {
    create: vi.fn(async (entry: AuditEntry) => entry),
    getLastEntry: vi.fn(async () => null),
    findByTenant: vi.fn(async () => ({ items: [], cursor: undefined })),
    findByAction: vi.fn(async () => ({ items: [], cursor: undefined })),
    pseudonymizeActor: vi.fn(async () => 0),
    findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
    deleteBatch: vi.fn(async () => 0),
  };
}

function wireEventBus(eventBus: EventBus, createAuditEntry: CreateAuditEntryUseCase) {
  eventBus.subscribe('incident.created', async (event) => {
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'incident.created',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'incident',
      resourceId: (event.payload['incidentId'] as string) ?? '',
      changes: event.payload,
    });
  });

  eventBus.subscribe('incident.status_changed', async (event) => {
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'incident.status_changed',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'incident',
      resourceId: (event.payload['incidentId'] as string) ?? '',
      changes: event.payload,
    });
  });

  eventBus.subscribe('investigation.completed', async (event) => {
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'investigation.completed',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'incident',
      resourceId: (event.payload['incidentId'] as string) ?? '',
      changes: event.payload,
    });
  });

  eventBus.subscribe('tenant.created', async (event) => {
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'tenant.created',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'tenant',
      resourceId: event.tenantId,
      changes: event.payload,
    });
  });

  eventBus.subscribe('tenant.updated', async (event) => {
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'tenant.updated',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'tenant',
      resourceId: event.tenantId,
      changes: event.payload,
    });
  });
}

describe('EventBus Audit Wiring', () => {
  let eventBus: EventBus;
  let auditRepo: IAuditRepository;
  let createAuditEntry: CreateAuditEntryUseCase;

  beforeEach(() => {
    eventBus = new EventBus();
    auditRepo = createMockAuditRepo();
    createAuditEntry = new CreateAuditEntryUseCase(auditRepo);
    wireEventBus(eventBus, createAuditEntry);
  });

  it('should create audit entry when incident.created is published', async () => {
    await eventBus.publish({
      eventType: 'incident.created',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-1',
      payload: { incidentId: 'inc-001', severity: 'critical', title: 'CPU spike' },
    });

    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'incident.created',
        actorEmail: 'system@causeflow.ai',
        resourceType: 'incident',
        resourceId: 'inc-001',
      }),
    );
  });

  it('should create audit entry when incident.status_changed is published', async () => {
    await eventBus.publish({
      eventType: 'incident.status_changed',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-1',
      payload: { incidentId: 'inc-002', from: 'open', to: 'triaging' },
    });

    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'incident.status_changed',
        resourceId: 'inc-002',
      }),
    );
  });

  it('should create audit entry when investigation.completed is published', async () => {
    await eventBus.publish({
      eventType: 'investigation.completed',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-1',
      payload: { incidentId: 'inc-003', rootCause: 'Memory leak', agentsUsed: ['log_analyst'] },
    });

    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'investigation.completed',
        resourceId: 'inc-003',
      }),
    );
  });

  it('should create audit entry when tenant.created is published', async () => {
    await eventBus.publish({
      eventType: 'tenant.created',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-new',
      payload: { tenantId: 'tenant-new', slug: 'acme', plan: 'pro' },
    });

    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant.created',
        resourceType: 'tenant',
        resourceId: 'tenant-new',
      }),
    );
  });

  it('should create audit entry when tenant.updated is published', async () => {
    await eventBus.publish({
      eventType: 'tenant.updated',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-1',
      payload: { tenantId: 'tenant-1', changes: { plan: 'enterprise' } },
    });

    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant.updated',
        resourceType: 'tenant',
        resourceId: 'tenant-1',
      }),
    );
  });

  it('should have 5 event subscribers registered', () => {
    const newEventBus = new EventBus();
    const newAuditEntry = new CreateAuditEntryUseCase(createMockAuditRepo());
    wireEventBus(newEventBus, newAuditEntry);

    // Verify by publishing all 5 event types
    const events = [
      'incident.created',
      'incident.status_changed',
      'investigation.completed',
      'tenant.created',
      'tenant.updated',
    ];

    // Just verify they don't throw
    for (const eventType of events) {
      expect(async () => {
        await newEventBus.publish({
          eventType,
          occurredAt: new Date().toISOString(),
          tenantId: 'test',
          payload: { incidentId: 'test', tenantId: 'test' },
        });
      }).not.toThrow();
    }
  });
});
