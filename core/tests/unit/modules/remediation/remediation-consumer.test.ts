import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock setup BEFORE imports ---
let capturedHandler: (message: any) => Promise<void>;
const mockConsumer = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() };

vi.mock('../../../../src/shared/infra/queue/sqs-consumer.js', () => ({
  createSQSConsumer: vi.fn((opts: any) => {
    capturedHandler = opts.handler;
    return mockConsumer;
  }),
}));

vi.mock('../../../../src/shared/infra/logger.js', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), child: vi.fn() };
  logger.child.mockReturnValue(logger);
  return { logger, rootLogger: logger };
});

import { startRemediationConsumer } from '../../../../src/modules/remediation/infra/remediation-consumer.js';
import type { ProposeRemediationUseCase } from '../../../../src/modules/remediation/application/propose-remediation.usecase.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

describe('RemediationConsumer', () => {
  const mockUseCase = { execute: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process a valid message with recommendedActions', async () => {
    startRemediationConsumer('http://remediation-queue-url', mockUseCase as unknown as ProposeRemediationUseCase);

    await capturedHandler({
      Body: JSON.stringify({
        incidentId: 'inc-500',
        tenantId: 'tenant-abc',
        rootCause: 'Memory leak in payment service',
        recommendedActions: [
          { action: 'restart_service', params: { service: 'payment-svc' } },
          { action: 'scale_up', params: { replicas: 3 } },
        ],
      }),
    });

    expect(mockUseCase.execute).toHaveBeenCalledOnce();
    expect(mockUseCase.execute).toHaveBeenCalledWith({
      tenantId: tenantId('tenant-abc'),
      incidentId: incidentId('inc-500'),
      rootCause: 'Memory leak in payment service',
      recommendedActions: [
        { action: 'restart_service', params: { service: 'payment-svc' } },
        { action: 'scale_up', params: { replicas: 3 } },
      ],
    });
  });

  it('should throw on invalid JSON in Body', async () => {
    startRemediationConsumer('http://remediation-queue-url', mockUseCase as unknown as ProposeRemediationUseCase);

    await expect(capturedHandler({ Body: '<<<invalid>>>' })).rejects.toThrow();
    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('should propagate use case errors', async () => {
    mockUseCase.execute.mockRejectedValueOnce(new Error('Remediation proposal failed'));
    startRemediationConsumer('http://remediation-queue-url', mockUseCase as unknown as ProposeRemediationUseCase);

    await expect(
      capturedHandler({
        Body: JSON.stringify({
          incidentId: 'inc-600',
          tenantId: 'tenant-xyz',
          rootCause: 'Disk full',
          recommendedActions: [{ action: 'cleanup_logs', params: {} }],
        }),
      }),
    ).rejects.toThrow('Remediation proposal failed');
  });

  it('should call consumer.start() on creation', () => {
    startRemediationConsumer('http://remediation-queue-url', mockUseCase as unknown as ProposeRemediationUseCase);

    expect(mockConsumer.start).toHaveBeenCalledOnce();
  });

  it('should handle empty recommendedActions array', async () => {
    startRemediationConsumer('http://remediation-queue-url', mockUseCase as unknown as ProposeRemediationUseCase);

    await capturedHandler({
      Body: JSON.stringify({
        incidentId: 'inc-700',
        tenantId: 'tenant-abc',
        rootCause: 'Transient network issue',
        recommendedActions: [],
      }),
    });

    expect(mockUseCase.execute).toHaveBeenCalledOnce();
    expect(mockUseCase.execute).toHaveBeenCalledWith({
      tenantId: tenantId('tenant-abc'),
      incidentId: incidentId('inc-700'),
      rootCause: 'Transient network issue',
      recommendedActions: [],
    });
  });
});
