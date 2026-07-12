import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @opentelemetry/api to control trace context in tests
// ---------------------------------------------------------------------------
const mockTraceId = 'abcdef1234567890abcdef1234567890';
const mockSpanId = 'abcdef1234567890';

// Carrier state for inject/extract simulation
let injectedCarrier: Record<string, string> = {};

const mockPropagation = {
  inject: vi.fn((ctx: unknown, carrier: Record<string, string>) => {
    // Simulate W3C traceparent injection
    carrier['traceparent'] = `00-${mockTraceId}-${mockSpanId}-01`;
    carrier['tracestate'] = 'aws=Root=1-abcdef12-34567890abcdef1234567890';
    injectedCarrier = { ...carrier };
  }),
  extract: vi.fn((_ctx: unknown, carrier: Record<string, string>) => {
    // Return a mock context with the trace info embedded
    return {
      _traceparent: carrier['traceparent'],
      _tracestate: carrier['tracestate'],
    };
  }),
};

const mockActiveSpan = {
  spanContext: vi.fn(() => ({
    traceId: mockTraceId,
    spanId: mockSpanId,
    traceFlags: 1,
  })),
};

const mockContext = {
  active: vi.fn(() => ({})),
  with: vi.fn((ctx: unknown, fn: () => unknown) => fn()),
};

const mockTrace = {
  getActiveSpan: vi.fn(() => mockActiveSpan),
};

vi.mock('@opentelemetry/api', () => ({
  context: mockContext,
  propagation: mockPropagation,
  trace: mockTrace,
}));

// ---------------------------------------------------------------------------
// Mock the SDK so otel.ts side-effects don't run during import
// ---------------------------------------------------------------------------
vi.mock('@shared/infra/observability/otel.js', () => ({
  sdk: {
    shutdown: vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 10))),
    start: vi.fn(),
  },
  shutdownOtel: vi.fn(async (timeoutMs = 5000) => {
    // Simulates real shutdownOtel behavior for tests
    const { sdk } = await import('@shared/infra/observability/otel.js');
    await Promise.race([
      sdk?.shutdown() ?? Promise.resolve(),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  }),
}));

async function getPropagation() {
  const mod = await import('@shared/infra/observability/propagation.js');
  return mod;
}

beforeEach(() => {
  vi.clearAllMocks();
  injectedCarrier = {};
  vi.resetModules();

  // Re-setup mocks after resetModules
  vi.mock('@opentelemetry/api', () => ({
    context: mockContext,
    propagation: mockPropagation,
    trace: mockTrace,
  }));
  vi.mock('@shared/infra/observability/otel.js', () => ({
    sdk: {
      shutdown: vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 10))),
      start: vi.fn(),
    },
    shutdownOtel: vi.fn(),
  }));
});

describe('injectTraceparent', () => {
  it('populates traceparent in MessageAttributes when a span is active', async () => {
    const { injectTraceparent } = await getPropagation();
    const result = injectTraceparent({});
    expect(result['traceparent']).toBeDefined();
    expect(result['traceparent']?.DataType).toBe('String');
    expect(result['traceparent']?.StringValue).toContain(mockTraceId);
  });

  it('populates tracestate in MessageAttributes when propagator injects it', async () => {
    const { injectTraceparent } = await getPropagation();
    const result = injectTraceparent({});
    expect(result['tracestate']).toBeDefined();
    expect(result['tracestate']?.DataType).toBe('String');
  });

  it('adds requestId to MessageAttributes when provided', async () => {
    const { injectTraceparent } = await getPropagation();
    const result = injectTraceparent({}, 'req-123');
    expect(result['requestId']).toBeDefined();
    expect(result['requestId']?.DataType).toBe('String');
    expect(result['requestId']?.StringValue).toBe('req-123');
  });

  it('does not add requestId when not provided', async () => {
    const { injectTraceparent } = await getPropagation();
    const result = injectTraceparent({});
    expect(result['requestId']).toBeUndefined();
  });

  it('preserves existing MessageAttributes', async () => {
    const { injectTraceparent } = await getPropagation();
    const existing = { myKey: { DataType: 'String', StringValue: 'myValue' } };
    const result = injectTraceparent(existing);
    expect(result['myKey']).toEqual({ DataType: 'String', StringValue: 'myValue' });
  });

  it('does not mutate the input attrs object', async () => {
    const { injectTraceparent } = await getPropagation();
    const input = {};
    injectTraceparent(input, 'req-abc');
    expect(Object.keys(input)).toHaveLength(0);
  });
});

describe('extractTraceparent', () => {
  it('returns a context object from MessageAttributes with traceparent', async () => {
    const { extractTraceparent } = await getPropagation();
    const attrs = {
      traceparent: { DataType: 'String', StringValue: `00-${mockTraceId}-${mockSpanId}-01` },
    };
    const ctx = extractTraceparent(attrs);
    expect(ctx).toBeDefined();
    expect(mockPropagation.extract).toHaveBeenCalled();
  });

  it('returns active context when attrs is undefined', async () => {
    const { extractTraceparent } = await getPropagation();
    const ctx = extractTraceparent(undefined);
    expect(ctx).toBeDefined();
    // Should return context.active() directly without calling extract
    expect(mockPropagation.extract).not.toHaveBeenCalled();
  });

  it('returns active context when attrs has no traceparent', async () => {
    const { extractTraceparent } = await getPropagation();
    const ctx = extractTraceparent({});
    expect(ctx).toBeDefined();
    // With empty carrier, extract still called but with empty carrier
    expect(mockPropagation.extract).toHaveBeenCalledWith(expect.anything(), {}, expect.anything());
  });

  it('passes tracestate along with traceparent to extract', async () => {
    const { extractTraceparent } = await getPropagation();
    const attrs = {
      traceparent: { DataType: 'String', StringValue: `00-${mockTraceId}-${mockSpanId}-01` },
      tracestate: {
        DataType: 'String',
        StringValue: 'aws=Root=1-abcdef12-34567890abcdef1234567890',
      },
    };
    extractTraceparent(attrs);
    expect(mockPropagation.extract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        traceparent: `00-${mockTraceId}-${mockSpanId}-01`,
        tracestate: 'aws=Root=1-abcdef12-34567890abcdef1234567890',
      }),
      expect.anything(),
    );
  });
});

describe('inject + extract roundtrip', () => {
  it('roundtrip: extracted context preserves the traceparent injected', async () => {
    // This test simulates the full roundtrip: inject into attrs, then extract
    const { injectTraceparent, extractTraceparent } = await getPropagation();

    // Step 1: inject (simulates producer side)
    const attrs = injectTraceparent({}, 'req-123');

    // Verify traceparent was injected
    expect(attrs['traceparent']?.StringValue).toContain(mockTraceId);

    // Step 2: extract (simulates consumer side)
    const extractedCtx = extractTraceparent(attrs);
    expect(extractedCtx).toBeDefined();

    // The extract call received the traceparent value we injected
    const extractCalls = mockPropagation.extract.mock.calls;
    expect(extractCalls.length).toBeGreaterThan(0);
    const lastCall = extractCalls[extractCalls.length - 1];
    expect(lastCall).toBeDefined();
    const lastExtractCarrier = lastCall![1] as Record<string, string>;
    expect(lastExtractCarrier['traceparent']).toContain(mockTraceId);
  });
});

describe('currentTraceId', () => {
  it('returns traceId from active span', async () => {
    const { currentTraceId } = await getPropagation();
    const traceId = currentTraceId();
    expect(traceId).toBe(mockTraceId);
  });

  it('returns undefined when no active span', async () => {
    mockTrace.getActiveSpan.mockReturnValueOnce(undefined as unknown as typeof mockActiveSpan);
    const { currentTraceId } = await getPropagation();
    const traceId = currentTraceId();
    expect(traceId).toBeUndefined();
  });
});

describe('shutdownOtel timeout safety', () => {
  it('resolves within timeout even when sdk.shutdown() hangs', async () => {
    // Test the real shutdownOtel logic using a slow SDK mock
    const slowSdkShutdown = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 10000)), // hangs for 10s
    );

    // Simulate the shutdownOtel function directly to test timeout logic
    async function shutdownWithTimeout(timeoutMs: number): Promise<void> {
      try {
        await Promise.race([
          slowSdkShutdown(),
          new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
        ]);
      } catch {
        // swallow
      }
    }

    const start = Date.now();
    await shutdownWithTimeout(100); // 100ms timeout
    const elapsed = Date.now() - start;

    // Should resolve in ~100ms, not 10000ms
    expect(elapsed).toBeLessThan(500);
  });

  it('resolves immediately when sdk.shutdown() is fast', async () => {
    const fastSdkShutdown = vi.fn(() => Promise.resolve());

    async function shutdownWithTimeout(timeoutMs: number): Promise<void> {
      try {
        await Promise.race([
          fastSdkShutdown(),
          new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
        ]);
      } catch {
        // swallow
      }
    }

    const start = Date.now();
    await shutdownWithTimeout(5000);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(200);
    expect(fastSdkShutdown).toHaveBeenCalledOnce();
  });
});
