import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProposeRemediationUseCase } from '../../../../src/modules/remediation/application/propose-remediation.usecase.js';
import type { IRemediationRepository } from '../../../../src/modules/remediation/domain/remediation.repository.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Remediation } from '../../../../src/modules/remediation/domain/remediation.entity.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { ChatPlatform } from '../../../../src/shared/application/ports/chat-platform.port.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';
import { RemediationAlreadyExistsError } from '../../../../src/modules/remediation/domain/remediation.errors.js';

function createMockRemediationRepo(): IRemediationRepository {
  return {
    create: vi.fn(async (r: Remediation) => r),
    findById: vi.fn(async () => null),
    findByIncident: vi.fn(async () => []),
    update: vi.fn(),
  };
}

function createMockIncidentRepo(): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => ({
      incidentId: 'inc-1',
      tenantId: 'tenant-1',
      title: 'CPU Spike',
      description: 'CPU at 95%',
      severity: 'critical',
      status: 'investigating',
      sourceProvider: 'datadog',
      sourceAlertId: 'alert-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }) as unknown as Incident),
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

function createMockChatPlatform(): ChatPlatform {
  return {
    name: 'mock',
    sendMessage: vi.fn(async () => ({ messageId: 'msg-1', threadId: 'thread-1' })),
    requestApproval: vi.fn(async () => ({
      approved: true,
      respondedBy: 'admin@test.com',
      respondedAt: new Date().toISOString(),
      selectedAction: 'approve',
    })),
    updateMessage: vi.fn(),
    testConnection: vi.fn(async () => true),
  };
}

describe('ProposeRemediationUseCase', () => {
  let remediationRepo: IRemediationRepository;
  let incidentRepo: IIncidentRepository;
  let eventBus: EventBus;
  let chatPlatform: ChatPlatform;
  let useCase: ProposeRemediationUseCase;

  beforeEach(() => {
    remediationRepo = createMockRemediationRepo();
    incidentRepo = createMockIncidentRepo();
    eventBus = new EventBus();
    chatPlatform = createMockChatPlatform();
    useCase = new ProposeRemediationUseCase(remediationRepo, incidentRepo, eventBus, chatPlatform);
  });

  it('should propose remediation with proposed status', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      rootCause: 'Memory leak in worker process',
      recommendedActions: [
        { action: 'restart_service', label: 'Restart service', description: 'Restarts the affected service pod', rationale: 'Service is unresponsive, restart will clear state', riskLevel: 'low', estimatedDuration: '5m', automated: false, params: { service: 'worker', region: 'sa-east-1' } },
        { action: 'scale_up', label: 'Scale up replicas', description: 'Increases replica count to handle load', rationale: 'High load requires more replicas', riskLevel: 'medium', estimatedDuration: '5m', automated: false, params: { replicas: 3 } },
      ],
    });

    expect(result.status).toBe('proposed');
    expect(result.rootCause).toBe('Memory leak in worker process');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.action).toBe('restart_service');
    expect(result.steps[0]?.params).toEqual({ service: 'worker', region: 'sa-east-1' });
    expect(result.steps[1]?.action).toBe('scale_up');
    expect(result.steps[1]?.params).toEqual({ replicas: 3 });
    expect(result.proposedBy).toBe('system');
    expect(remediationRepo.create).toHaveBeenCalledTimes(1);
  });

  it('should publish remediation.proposed event', async () => {
    const handler = vi.fn();
    eventBus.subscribe('remediation.proposed', handler);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      rootCause: 'DB connection pool exhausted',
      recommendedActions: [{ action: 'restart_db_pool', label: 'Restart DB pool', description: 'Restarts the database connection pool', rationale: 'Connection pool exhausted, restart will reset connections', riskLevel: 'medium', estimatedDuration: '5m', automated: false, params: {} }],
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'remediation.proposed',
      payload: expect.objectContaining({ incidentId: 'inc-1' }),
    });
  });

  it('should transition incident to awaiting_approval', async () => {
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      rootCause: 'High latency',
      recommendedActions: [{ action: 'scale_up', label: 'Scale up replicas', description: 'Increases replica count to handle load', rationale: 'High load requires more replicas', riskLevel: 'medium', estimatedDuration: '5m', automated: false, params: {} }],
    });

    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-1'),
      'awaiting_approval',
    );
  });

  it('should call chatPlatform.requestApproval', async () => {
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      rootCause: 'Disk full',
      recommendedActions: [
        { action: 'cleanup_logs', label: 'Clean up logs', description: 'Removes old log files to free disk space', rationale: 'Disk full due to log accumulation', riskLevel: 'low', estimatedDuration: '5m', automated: false, params: {} },
        { action: 'expand_volume', label: 'Expand volume', description: 'Expands the disk volume to increase capacity', rationale: 'Disk volume near capacity limit', riskLevel: 'medium', estimatedDuration: '5m', automated: false, params: {} },
      ],
    });

    expect(chatPlatform.requestApproval).toHaveBeenCalledTimes(1);
    expect(chatPlatform.requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('CPU Spike'),
        actions: expect.arrayContaining([
          expect.objectContaining({ label: 'Approve' }),
          expect.objectContaining({ label: 'Reject' }),
        ]),
      }),
    );
  });

  it('should throw NotFoundError when incident does not exist', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        incidentId: incidentId('inc-999'),
        rootCause: 'Unknown',
        recommendedActions: [{ action: 'check', label: 'Check service', description: 'Checks service health and status', rationale: 'Service health needs verification', riskLevel: 'low', estimatedDuration: '5m', automated: false, params: {} }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should include fix summary in description when proposedFix provided', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      rootCause: 'Connection pool leak',
      recommendedActions: [{ action: 'restart_service', label: 'Restart service', description: 'Restarts the affected service pod', rationale: 'Service is unresponsive, restart will clear state', riskLevel: 'low', estimatedDuration: '5m', automated: false, params: {} }],
      proposedFix: {
        repoFullName: 'acme/payment-service',
        files: [{ path: 'src/payments.ts', content: 'fixed', changeDescription: 'Added finally block' }],
        summary: 'Fix connection pool leak by adding finally block',
        testSuggestions: ['Test error path'],
      },
    });

    expect(result.description).toContain('Fix connection pool leak by adding finally block');
    expect(result.description).toContain('src/payments.ts');
    expect(result.description).toContain('draft PR will be created upon approval');
  });

  it('should throw RemediationAlreadyExistsError when active remediation exists', async () => {
    vi.mocked(remediationRepo.findByIncident).mockResolvedValueOnce([
      { status: 'proposed' } as Remediation,
    ]);

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        incidentId: incidentId('inc-1'),
        rootCause: 'Duplicate',
        recommendedActions: [{ action: 'noop', label: 'No operation', description: 'Placeholder action with no effect', rationale: 'No action required', riskLevel: 'low', estimatedDuration: '5m', automated: false, params: {} }],
      }),
    ).rejects.toThrow(RemediationAlreadyExistsError);
  });
});
