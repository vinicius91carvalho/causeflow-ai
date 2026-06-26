import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateManualIncidentUseCase } from '../../../../src/modules/ingestion/application/create-manual-incident.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

function createMockRepo(): IIncidentRepository {
  return {
    create: vi.fn(async (i: Incident) => i),
    findById: vi.fn(),
    findBySourceAlert: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
  };
}

function createMockMessageQueue() {
  return { send: vi.fn().mockResolvedValue(undefined), receive: vi.fn(), deleteMessage: vi.fn() };
}

describe('CreateManualIncidentUseCase', () => {
  let repo: IIncidentRepository;
  let eventBus: EventBus;
  let messageQueue: ReturnType<typeof createMockMessageQueue>;
  let useCase: CreateManualIncidentUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockRepo();
    eventBus = new EventBus();
    messageQueue = createMockMessageQueue();
    useCase = new CreateManualIncidentUseCase(
      repo,
      eventBus,
      messageQueue,
      'http://alert-queue',
      'http://investigation-queue',
    );
  });

  it('should create incident with sourceProvider=chat', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      title: 'API is returning 500 errors',
      description: 'The payment service keeps returning 500 errors',
      createdBy: 'admin@test.com',
    });

    expect(result.sourceProvider).toBe('chat');
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it('with severity: should enqueue investigation and status triaging', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      title: 'Critical memory leak detected',
      description: 'OOM kills happening every 5 minutes',
      severity: 'high',
      createdBy: 'admin@test.com',
    });

    expect(result.status).toBe('triaging');
    expect(messageQueue.send).toHaveBeenCalledWith(
      'http://investigation-queue',
      expect.objectContaining({ severity: 'high' }),
    );
  });

  it('without severity: should enqueue alert and status open', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      title: 'Something seems off',
      description: 'The system is behaving strangely, not sure what the severity is',
      createdBy: 'admin@test.com',
    });

    expect(result.status).toBe('open');
    expect(messageQueue.send).toHaveBeenCalledWith(
      'http://alert-queue',
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
  });

  it('should reject title shorter than 5 chars', async () => {
    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        title: 'Hi',
        description: 'The system is behaving strangely',
        createdBy: 'admin@test.com',
      }),
    ).rejects.toThrow('Title must be at least 5 characters');
  });

  it('should reject description shorter than 10 chars', async () => {
    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        title: 'Valid title',
        description: 'Short',
        createdBy: 'admin@test.com',
      }),
    ).rejects.toThrow('Description must be at least 10 characters');
  });

  it('should publish incident.created event with source chat', async () => {
    const handler = vi.fn();
    eventBus.subscribe('incident.created', handler);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      title: 'API is returning 500 errors',
      description: 'The payment service keeps returning 500 errors',
      createdBy: 'admin@test.com',
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]![0]).toMatchObject({
      eventType: 'incident.created',
      payload: expect.objectContaining({
        source: 'chat',
      }),
    });
  });
});
