import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  LLMClient,
  CompletionResult,
} from '../../../../src/shared/application/ports/llm-client.port.js';
import type { Tracer, Span } from '../../../../src/shared/application/ports/tracer.port.js';
import type { MetricRecorder } from '../../../../src/shared/application/ports/metric-recorder.port.js';

// Mock currentTraceId to simulate OTel active span
const mockCurrentTraceId = vi.fn((): string | undefined => 'abcdef1234567890abcdef1234567890');
vi.mock('../../../../src/shared/infra/observability/propagation.js', () => ({
  currentTraceId: () => mockCurrentTraceId(),
}));

import { ObservedAnthropicClient } from '../../../../src/shared/infra/llm/observed-anthropic-client.js';

function createMockSpan(): Span {
  return {
    setAttribute: vi.fn(),
    setInput: vi.fn(),
    setOutput: vi.fn(),
    setUsage: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
  };
}

function createMockTracer(span: Span): Tracer {
  return {
    startSpan: vi.fn().mockReturnValue(span),
    flush: vi.fn(),
    shutdown: vi.fn(),
  };
}

function createMockMetrics(): MetricRecorder {
  return {
    increment: vi.fn(),
    gauge: vi.fn(),
    histogram: vi.fn(),
  };
}

describe('ObservedAnthropicClient', () => {
  let mockInner: LLMClient;
  let mockSpan: Span;
  let mockTracer: Tracer;
  let mockMetrics: MetricRecorder;
  let client: ObservedAnthropicClient;

  const mockResult: CompletionResult<string> = {
    content: 'test response',
    usage: { inputTokens: 100, outputTokens: 50 },
    model: 'claude-haiku-4-5-20251001',
    costUsd: 0.001,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInner = { complete: vi.fn().mockResolvedValue(mockResult) };
    mockSpan = createMockSpan();
    mockTracer = createMockTracer(mockSpan);
    mockMetrics = createMockMetrics();
    client = new ObservedAnthropicClient(mockInner, mockTracer, mockMetrics);
    mockCurrentTraceId.mockReturnValue('abcdef1234567890abcdef1234567890');
  });

  it('should delegate to inner client and return result', async () => {
    const result = await client.complete({
      systemPrompt: 'test',
      userPrompt: 'hello',
      maxTokens: 100,
    });

    expect(result).toEqual(mockResult);
    expect(mockInner.complete).toHaveBeenCalledOnce();
  });

  it('should create and close span on success', async () => {
    await client.complete({
      systemPrompt: 'test',
      userPrompt: 'hello',
      maxTokens: 100,
    });

    expect(mockTracer.startSpan).toHaveBeenCalledWith(
      'llm.complete',
      expect.any(Object),
      undefined,
      'generation',
    );
    expect(mockSpan.setInput).toHaveBeenCalled();
    expect(mockSpan.setUsage).toHaveBeenCalledWith({
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
    });
    expect(mockSpan.setOutput).toHaveBeenCalledWith('test response');
    expect(mockSpan.setStatus).toHaveBeenCalledWith('ok');
    expect(mockSpan.end).toHaveBeenCalled();
  });

  it('should record metrics on success', async () => {
    await client.complete({
      systemPrompt: 'test',
      userPrompt: 'hello',
      maxTokens: 100,
    });

    expect(mockMetrics.increment).toHaveBeenCalledWith('llm.calls', 1, expect.any(Object));
    expect(mockMetrics.increment).toHaveBeenCalledWith('llm.input_tokens', 100, expect.any(Object));
    expect(mockMetrics.increment).toHaveBeenCalledWith('llm.output_tokens', 50, expect.any(Object));
    expect(mockMetrics.histogram).toHaveBeenCalledWith('llm.cost_usd', 0.001, expect.any(Object));
  });

  it('should set error status on failure and rethrow', async () => {
    const error = new Error('API error');
    vi.mocked(mockInner.complete).mockRejectedValueOnce(error);

    await expect(
      client.complete({ systemPrompt: 'test', userPrompt: 'hello', maxTokens: 100 }),
    ).rejects.toThrow('API error');

    expect(mockSpan.setStatus).toHaveBeenCalledWith('error', 'API error');
    expect(mockMetrics.increment).toHaveBeenCalledWith('llm.errors', 1, expect.any(Object));
    expect(mockSpan.end).toHaveBeenCalled();
  });

  describe('OTel-Langfuse bridge', () => {
    it('should set otelTraceId attribute on span when OTel span is active', async () => {
      mockCurrentTraceId.mockReturnValue('abcdef1234567890abcdef1234567890');

      await client.complete({
        systemPrompt: 'test',
        userPrompt: 'hello',
        maxTokens: 100,
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'otelTraceId',
        'abcdef1234567890abcdef1234567890',
      );
    });

    it('should not set otelTraceId attribute when no OTel span is active', async () => {
      mockCurrentTraceId.mockReturnValue(undefined);

      await client.complete({
        systemPrompt: 'test',
        userPrompt: 'hello',
        maxTokens: 100,
      });

      const calls = vi
        .mocked(mockSpan.setAttribute)
        .mock.calls.filter(([key]) => key === 'otelTraceId');
      expect(calls).toHaveLength(0);
    });
  });
});
