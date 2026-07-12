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

const mockDispatchInvestigation = vi.fn().mockResolvedValue('task-arn-123');
vi.mock('../../../../src/shared/infra/investigation/ecs-task-dispatcher.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  dispatchInvestigation: (...args: unknown[]) => mockDispatchInvestigation(...args) as unknown,
}));

vi.mock('../../../../src/shared/infra/logger.js', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return { logger, rootLogger: logger };
});

import { startInvestigationConsumer } from '../../../../src/modules/investigation/infra/investigation-consumer.js';

describe('InvestigationConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process a valid message with suggestedAgents', async () => {
    startInvestigationConsumer('http://investigation-queue-url');

    await capturedHandler({
      Body: JSON.stringify({
        incidentId: 'inc-100',
        tenantId: 'tenant-abc',
        severity: 'critical',
        suggestedAgents: ['log_analyst', 'change_detector'],
      }),
    });

    expect(mockDispatchInvestigation).toHaveBeenCalledOnce();
    expect(mockDispatchInvestigation).toHaveBeenCalledWith({
      tenantId: 'tenant-abc',
      incidentId: 'inc-100',
      suggestedAgents: ['log_analyst', 'change_detector'],
    });
  });

  it('should fallback to default agents when suggestedAgents is missing', async () => {
    startInvestigationConsumer('http://investigation-queue-url');

    await capturedHandler({
      Body: JSON.stringify({
        incidentId: 'inc-200',
        tenantId: 'tenant-xyz',
        severity: 'high',
      }),
    });

    expect(mockDispatchInvestigation).toHaveBeenCalledOnce();
    expect(mockDispatchInvestigation).toHaveBeenCalledWith({
      tenantId: 'tenant-xyz',
      incidentId: 'inc-200',
      suggestedAgents: [
        'log_analyst',
        'metric_analyst',
        'change_detector',
        'code_analyzer',
        'infra_inspector',
        'db_analyst',
      ],
    });
  });

  it('should throw on invalid JSON in Body', async () => {
    startInvestigationConsumer('http://investigation-queue-url');

    await expect(capturedHandler({ Body: '{bad-json' })).rejects.toThrow();
    expect(mockDispatchInvestigation).not.toHaveBeenCalled();
  });

  it('should propagate dispatch errors', async () => {
    mockDispatchInvestigation.mockRejectedValueOnce(new Error('Fargate dispatch failed'));
    startInvestigationConsumer('http://investigation-queue-url');

    await expect(
      capturedHandler({
        Body: JSON.stringify({
          incidentId: 'inc-300',
          tenantId: 'tenant-abc',
          severity: 'medium',
          suggestedAgents: ['log_analyst'],
        }),
      }),
    ).rejects.toThrow('Fargate dispatch failed');
  });

  it('should call consumer.start() on creation', () => {
    startInvestigationConsumer('http://investigation-queue-url');

    expect(mockConsumer.start).toHaveBeenCalledOnce();
  });
});
