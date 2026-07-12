import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestAlertUseCase } from '../../../../src/modules/ingestion/application/ingest-alert.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { MessageQueue } from '../../../../src/shared/application/ports/message-queue.port.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { ProviderRegistry } from '../../../../src/shared/application/provider-registry.js';
import { DatadogParser } from '../../../../src/modules/ingestion/infra/parsers/datadog.parser.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';
import { ValidationError } from '../../../../src/shared/domain/errors.js';

function createMockRepo(): IIncidentRepository {
  return {
    create: vi.fn(async (i: Incident) => i),
    findById: vi.fn(async () => null),
    findBySourceAlert: vi.fn(async () => null),
    update: vi.fn(),
    updateStatus: vi.fn(),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
  };
}

function createMockMessageQueue(): MessageQueue {
  return {
    send: vi.fn(async () => {}),
  };
}

describe('IngestAlertUseCase', () => {
  let repo: IIncidentRepository;
  let eventBus: EventBus;
  let registry: ProviderRegistry;
  let messageQueue: MessageQueue;
  let useCase: IngestAlertUseCase;

  beforeEach(() => {
    repo = createMockRepo();
    eventBus = new EventBus();
    registry = new ProviderRegistry();
    messageQueue = createMockMessageQueue();
    registry.registerAlertParser('datadog', new DatadogParser());
    useCase = new IngestAlertUseCase(
      repo,
      eventBus,
      registry,
      messageQueue,
      'http://localhost:4566/queue/alerts',
    );
  });

  it('should ingest alert and create incident', async () => {
    const incident = await useCase.execute(tenantId('tenant-1'), {
      source: 'datadog',
      externalId: 'alert-123',
      payload: {
        alert_type: 'error',
        title: 'CPU High',
        body: 'CPU at 95%',
        tags: ['env:production', 'service:api'],
      },
    });

    expect(incident.title).toBe('CPU High');
    expect(incident.severity).toBe('critical');
    expect(incident.status).toBe('open');
    expect(incident.sourceProvider).toBe('datadog');
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('should return existing incident when duplicate alert (idempotent)', async () => {
    const existingIncident = {
      incidentId: 'inc-existing',
      tenantId: 'tenant-1',
      title: 'Existing',
      sourceProvider: 'datadog',
      sourceAlertId: 'alert-123',
      createdAt: new Date().toISOString(),
    } as unknown as Incident;

    vi.mocked(repo.findBySourceAlert).mockResolvedValueOnce(existingIncident);

    const result = await useCase.execute(tenantId('tenant-1'), {
      source: 'datadog',
      externalId: 'alert-123',
      payload: { alert_type: 'error', title: 'CPU High' },
    });

    expect(result).toBe(existingIncident);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('should publish incident.created event', async () => {
    const handler = vi.fn();
    eventBus.subscribe('incident.created', handler);

    await useCase.execute(tenantId('tenant-1'), {
      source: 'datadog',
      externalId: 'alert-456',
      payload: { alert_type: 'warning', title: 'Disk Usage' },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'incident.created',
      payload: expect.objectContaining({ title: 'Disk Usage' }),
    });
  });

  it('should enqueue to alert queue via MessageQueue port', async () => {
    await useCase.execute(tenantId('tenant-1'), {
      source: 'datadog',
      externalId: 'alert-789',
      payload: { alert_type: 'error', title: 'API Down' },
    });

    expect(messageQueue.send).toHaveBeenCalledWith(
      'http://localhost:4566/queue/alerts',
      expect.objectContaining({
        tenantId: 'tenant-1',
        severity: expect.any(String),
      }),
    );
  });

  it('should not enqueue when no messageQueue provided', async () => {
    const useCaseWithoutQueue = new IngestAlertUseCase(repo, eventBus, registry);

    await useCaseWithoutQueue.execute(tenantId('tenant-1'), {
      source: 'datadog',
      externalId: 'alert-000',
      payload: { alert_type: 'error', title: 'Test' },
    });

    expect(messageQueue.send).not.toHaveBeenCalled();
  });

  it('should throw ValidationError when no parser found', async () => {
    await expect(
      useCase.execute(tenantId('tenant-1'), {
        source: 'unknown-provider',
        externalId: 'alert-789',
        payload: { foo: 'bar' },
      }),
    ).rejects.toThrow(ValidationError);
  });
});
