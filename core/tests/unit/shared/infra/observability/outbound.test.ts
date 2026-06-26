import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @opentelemetry/api so the real OTel SDK is not required in unit tests
// ---------------------------------------------------------------------------
const mockSpan = {
  setAttribute: vi.fn(),
  setStatus: vi.fn(),
  recordException: vi.fn(),
  end: vi.fn(),
};

const mockTracer = {
  startActiveSpan: vi.fn((name: string, fn: (span: typeof mockSpan) => Promise<unknown>) => fn(mockSpan)),
};

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(() => mockTracer),
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
    UNSET: 0,
  },
}));

// ---------------------------------------------------------------------------
// Mock the log-context module so we can capture log calls
// ---------------------------------------------------------------------------
const mockInfo = vi.fn();
const mockError = vi.fn();
const mockLogger = {
  info: mockInfo,
  error: mockError,
};

vi.mock('@shared/infra/logger/log-context.js', () => ({
  getLogger: () => mockLogger,
}));

async function getInstrumentedCall() {
  const { instrumentedCall } = await import('@shared/infra/observability/outbound.js');
  return instrumentedCall;
}

function lastInfoCall(): [Record<string, unknown>, string] {
  const call = mockInfo.mock.calls.at(-1);
  if (!call) throw new Error('No info call recorded');
  return call as [Record<string, unknown>, string];
}

function lastErrorCall(): [Record<string, unknown>, string] {
  const call = mockError.mock.calls.at(-1);
  if (!call) throw new Error('No error call recorded');
  return call as [Record<string, unknown>, string];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('instrumentedCall', () => {
  it('resolves with the function return value', async () => {
    const instrumentedCall = await getInstrumentedCall();
    const result = await instrumentedCall('x', 'y', async () => 42);
    expect(result).toBe(42);
  });

  it('emits info log with ok: true, target, op, durationMs on success', async () => {
    const instrumentedCall = await getInstrumentedCall();
    await instrumentedCall('x', 'y', async () => 42);
    expect(mockInfo).toHaveBeenCalledOnce();
    const [logObj, msg] = lastInfoCall();
    expect(logObj).toMatchObject({ target: 'x', op: 'y', ok: true });
    expect(typeof logObj['durationMs']).toBe('number');
    expect(msg).toBe('x.y ok');
  });

  it('re-throws the error when fn rejects', async () => {
    const instrumentedCall = await getInstrumentedCall();
    const boom = new Error('boom');
    await expect(instrumentedCall('a', 'b', async () => { throw boom; })).rejects.toThrow('boom');
  });

  it('logs error with errorType and truncated message, NOT raw err or error field', async () => {
    const instrumentedCall = await getInstrumentedCall();
    const secret = 'sk-abc123';
    const err = new Error(`Invalid token: ${secret}`);
    await expect(instrumentedCall('svc', 'call', async () => { throw err; })).rejects.toThrow();

    expect(mockError).toHaveBeenCalledOnce();
    const [logObj] = lastErrorCall();

    // Must have errorType and message
    expect(logObj['errorType']).toBe('Error');
    expect(String(logObj['message'])).toContain('Invalid token: sk-abc123');
    expect(String(logObj['message']).length).toBeLessThanOrEqual(200);

    // MUST NOT contain raw 'err' or 'error' key
    expect(Object.keys(logObj)).not.toContain('err');
    expect(Object.keys(logObj)).not.toContain('error');
  });

  it('truncates message longer than 200 chars', async () => {
    const instrumentedCall = await getInstrumentedCall();
    const longMsg = 'x'.repeat(300);
    const err = new Error(longMsg);
    await expect(instrumentedCall('svc', 'call', async () => { throw err; })).rejects.toThrow();
    const [logObj] = lastErrorCall();
    expect(String(logObj['message']).length).toBe(200);
  });

  it('filters attributes to allowlist only — model and inputTokens pass, requestBody and headers do not', async () => {
    const instrumentedCall = await getInstrumentedCall();
    await instrumentedCall('anthropic', 'messages', async () => 'ok', {
      attributes: {
        model: 'claude-3-5-sonnet',
        inputTokens: 150,
        requestBody: { secret: 'sk-xxx' },
        headers: { authorization: 'Bearer x' },
      },
    });

    // Check that the logged object has allowed attrs only
    const [logObj] = lastInfoCall();
    expect(logObj['model']).toBe('claude-3-5-sonnet');
    expect(logObj['inputTokens']).toBe(150);
    expect(logObj).not.toHaveProperty('requestBody');
    expect(logObj).not.toHaveProperty('headers');
  });

  it('accepts statusCode from AWS $metadata', async () => {
    const instrumentedCall = await getInstrumentedCall();
    const awsErr = Object.assign(new Error('NotFound'), { $metadata: { httpStatusCode: 404 } });
    await expect(instrumentedCall('dynamodb', 'get', async () => { throw awsErr; })).rejects.toThrow();
    const [logObj] = lastErrorCall();
    expect(logObj['statusCode']).toBe(404);
  });
});
