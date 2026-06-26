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

import { startTriageConsumer } from '../../../../src/modules/triage/infra/triage-consumer.js';
import type { TriageIncidentUseCase } from '../../../../src/modules/triage/application/triage-incident.usecase.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

describe('TriageConsumer', () => {
  const mockUseCase = { execute: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process a valid alert message', async () => {
    startTriageConsumer('http://triage-queue-url', mockUseCase as unknown as TriageIncidentUseCase);

    await capturedHandler({
      Body: JSON.stringify({
        incidentId: 'inc-001',
        tenantId: 'tenant-abc',
        severity: 'critical',
      }),
    });

    expect(mockUseCase.execute).toHaveBeenCalledOnce();
    expect(mockUseCase.execute).toHaveBeenCalledWith(
      tenantId('tenant-abc'),
      incidentId('inc-001'),
    );
  });

  it('should throw on invalid JSON in Body', async () => {
    startTriageConsumer('http://triage-queue-url', mockUseCase as unknown as TriageIncidentUseCase);

    await expect(capturedHandler({ Body: 'not-json' })).rejects.toThrow();
    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('should throw when Body is null', async () => {
    startTriageConsumer('http://triage-queue-url', mockUseCase as unknown as TriageIncidentUseCase);

    // null Body => parsedBody undefined => b.tenantId throws TypeError
    await expect(capturedHandler({ Body: null })).rejects.toThrow();
    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('should propagate use case errors', async () => {
    mockUseCase.execute.mockRejectedValueOnce(new Error('Triage failed'));
    startTriageConsumer('http://triage-queue-url', mockUseCase as unknown as TriageIncidentUseCase);

    await expect(
      capturedHandler({
        Body: JSON.stringify({ incidentId: 'inc-002', tenantId: 'tenant-xyz', severity: 'high' }),
      }),
    ).rejects.toThrow('Triage failed');
  });

  it('should call consumer.start() on creation', () => {
    startTriageConsumer('http://triage-queue-url', mockUseCase as unknown as TriageIncidentUseCase);

    expect(mockConsumer.start).toHaveBeenCalledOnce();
  });
});
