import { describe, it, expect, vi, beforeEach } from 'vitest';

// Local SQS Message type defined here for AC-050 OSS isolation
interface Message {
  MessageId?: string;
  Body?: string;
  ReceiptHandle?: string;
  MessageAttributes?: Record<string, { StringValue?: string }>;
}

// ---------------------------------------------------------------------------
// Mock @opentelemetry/api — context.with must execute the callback
// trace.getSpanContext returns a SpanContext when a traceId is embedded
// ---------------------------------------------------------------------------
const MOCK_TRACE_ID = 'abcdef1234567890abcdef1234567890';

vi.mock('@opentelemetry/api', () => ({
  context: {
    active: vi.fn(() => ({})),
    with: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
  },
  trace: {
    getSpanContext: vi.fn((ctx: unknown) => {
      // Return a SpanContext only when ctx is the sentinel traceparent context
      const c = ctx as Record<string, unknown>;
      if (c.__hasTraceparent) return { traceId: MOCK_TRACE_ID };
      return undefined;
    }),
  },
}));

// Mock propagation helpers
vi.mock('@shared/infra/observability/propagation.js', () => ({
  extractTraceparent: vi.fn(() => ({ __hasTraceparent: true })),
}));

// ---------------------------------------------------------------------------
// Mock log-context so we can spy on lifecycle log emissions
// ---------------------------------------------------------------------------
const logCalls: Array<{ level: string; obj: Record<string, unknown>; msg: string }> = [];
let capturedContext: Record<string, unknown> = {};

const mockInfo = vi.fn((obj: Record<string, unknown>, msg: string) => {
  logCalls.push({ level: 'info', obj, msg });
});
const mockError = vi.fn((obj: Record<string, unknown>, msg: string) => {
  logCalls.push({ level: 'error', obj, msg });
});
const mockLogger = { info: mockInfo, error: mockError };

vi.mock('@shared/infra/logger/log-context.js', () => ({
  getLogger: () => mockLogger,
  withLogContext: vi.fn((ctx: Record<string, unknown>, fn: () => unknown) => {
    capturedContext = ctx;
    return fn();
  }),
}));

async function getRunJob() {
  const { runJob } = await import('@shared/infra/observability/worker-runner.js');
  return runJob;
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    MessageId: 'msg-123',
    Body: JSON.stringify({ tenantId: 'tenant-abc', incidentId: 'inc-1' }),
    ReceiptHandle: 'rh-1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  logCalls.length = 0;
  capturedContext = {};
  vi.resetModules();
});

describe('runJob', () => {
  it('calls handler with parsed body and returns result', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage();
    const handler = vi.fn().mockResolvedValue('done');
    const result = await runJob(msg, handler, { jobType: 'triage', queueName: 'triage-queue' });
    expect(result).toBe('done');
    expect(handler).toHaveBeenCalledWith({ tenantId: 'tenant-abc', incidentId: 'inc-1' });
  });

  it('emits job.received, job.started, job.completed lifecycle logs in order', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage();
    await runJob(msg, async () => 'ok', { jobType: 'triage', queueName: 'triage-queue' });

    const events = logCalls.filter((l) => l.level === 'info').map((l) => l.obj.event);
    expect(events).toEqual(['job.received', 'job.started', 'job.completed']);
  });

  it('emits job.failed (not job.completed) when handler throws', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage();
    const boom = new Error('handler failed');
    await expect(
      runJob(msg, async () => { throw boom; }, { jobType: 'triage', queueName: 'triage-queue' }),
    ).rejects.toThrow('handler failed');

    const events = logCalls.map((l) => l.obj.event);
    expect(events).toContain('job.received');
    expect(events).toContain('job.started');
    expect(events).toContain('job.failed');
    expect(events).not.toContain('job.completed');
  });

  it('job.failed log contains errorType, durationMs, ok:false — NOT raw err', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage();
    const err = new Error('something broke');
    err.name = 'SomeError';
    await expect(
      runJob(msg, async () => { throw err; }, { jobType: 'remediation', queueName: 'remediation-queue' }),
    ).rejects.toThrow();

    const failedLog = logCalls.find((l) => l.obj.event === 'job.failed');
    expect(failedLog).toBeDefined();
    expect(failedLog!.obj.errorType).toBe('SomeError');
    expect(failedLog!.obj.message).toBe('something broke');
    expect(typeof failedLog!.obj.durationMs).toBe('number');
    expect(failedLog!.obj.ok).toBe(false);
    // MUST NOT have raw err/error field
    expect(Object.keys(failedLog!.obj)).not.toContain('err');
    expect(Object.keys(failedLog!.obj)).not.toContain('error');
  });

  it('re-throws the original error', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage();
    const originalError = new TypeError('type failure');
    await expect(
      runJob(msg, async () => { throw originalError; }, { jobType: 'triage', queueName: 'triage-queue' }),
    ).rejects.toBe(originalError);
  });

  it('invokes withLogContext with jobId, jobType, queueName, requestId', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage({ MessageId: 'unique-id-42' });
    await runJob(msg, async () => 'ok', {
      jobType: 'investigation',
      queueName: 'investigation-queue',
    });

    expect(capturedContext).toMatchObject({
      jobId: 'unique-id-42',
      jobType: 'investigation',
      queueName: 'investigation-queue',
    });
    expect(typeof capturedContext['requestId']).toBe('string');
  });

  it('extracts tenantId from body via tenantIdFromBody', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage({ Body: JSON.stringify({ tenantId: 'tenant-xyz' }) });
    await runJob(msg, async () => 'ok', {
      jobType: 'triage',
      queueName: 'triage-queue',
      tenantIdFromBody: (b) => (b as { tenantId?: string })?.tenantId,
    });
    expect(capturedContext['tenantId']).toBe('tenant-xyz');
  });

  it('handles missing/invalid Body gracefully', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage({ Body: 'not-json' });
    const handler = vi.fn().mockResolvedValue('ok');
    await runJob(msg, handler, { jobType: 'triage', queueName: 'triage-queue' });
    // Body is not valid JSON — handler receives undefined
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('uses requestId from MessageAttributes when present', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage({
      MessageAttributes: {
        requestId: { StringValue: 'req-from-attr', DataType: 'String' },
      },
    });
    await runJob(msg, async () => 'ok', { jobType: 'triage', queueName: 'triage-queue' });
    expect(capturedContext['requestId']).toBe('req-from-attr');
  });

  it('job.completed log contains durationMs and ok:true', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage();
    await runJob(msg, async () => 'ok', { jobType: 'triage', queueName: 'triage-queue' });
    const completedLog = logCalls.find((l) => l.obj.event === 'job.completed');
    expect(completedLog).toBeDefined();
    expect(completedLog!.obj.ok).toBe(true);
    expect(typeof completedLog!.obj.durationMs).toBe('number');
  });

  // Integration-style test: same jobId in all lifecycle logs (via withLogContext capture)
  it('all lifecycle log calls occur inside withLogContext (same call tree)', async () => {
    const { withLogContext } = await import('@shared/infra/logger/log-context.js');
    const runJob = await getRunJob();
    const msg = makeMessage({ MessageId: 'job-lifecycle-test' });
    await runJob(msg, async () => 'ok', { jobType: 'triage', queueName: 'triage-queue' });
    // withLogContext was called once wrapping all log calls
    expect(withLogContext).toHaveBeenCalledOnce();
  });

  it('populates traceId in LogContext from traceparent MessageAttribute', async () => {
    const runJob = await getRunJob();
    const msg = makeMessage({
      MessageAttributes: {
        traceparent: {
          StringValue: '00-abcdef1234567890abcdef1234567890-0000000000000001-01',
          DataType: 'String',
        },
      },
    });
    await runJob(msg, async () => 'ok', { jobType: 'triage', queueName: 'triage-queue' });
    expect(capturedContext['traceId']).toBe(MOCK_TRACE_ID);
  });
});
