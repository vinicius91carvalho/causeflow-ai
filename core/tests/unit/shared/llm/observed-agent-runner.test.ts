import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObservedAgentRunner } from '../../../../src/shared/infra/llm/observed-agent-runner.js';
import type { AgentRunner, AgentRunResult } from '../../../../src/shared/application/ports/agent-runner.port.js';
import type { Tracer, Span } from '../../../../src/shared/application/ports/tracer.port.js';
import type { MetricRecorder } from '../../../../src/shared/application/ports/metric-recorder.port.js';

function createMockSpan(): Span {
  return { setAttribute: vi.fn(), setInput: vi.fn(), setOutput: vi.fn(), setUsage: vi.fn(), setStatus: vi.fn(), end: vi.fn() };
}

function createMockTracer(span: Span): Tracer {
  return { startSpan: vi.fn().mockReturnValue(span), flush: vi.fn(), shutdown: vi.fn() };
}

function createMockMetrics(): MetricRecorder {
  return { increment: vi.fn(), gauge: vi.fn(), histogram: vi.fn() };
}

describe('ObservedAgentRunner', () => {
  let mockInner: AgentRunner;
  let mockSpan: Span;
  let mockTracer: Tracer;
  let mockMetrics: MetricRecorder;
  let runner: ObservedAgentRunner;

  const mockResult: AgentRunResult = {
    response: 'agent output',
    toolCalls: [{ name: 'tool1', input: {}, output: 'result' }],
    totalUsage: { inputTokens: 200, outputTokens: 100 },
    turns: 3,
    model: 'claude-haiku-4-5-20251001',
    costUsd: 0.002,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInner = { run: vi.fn().mockResolvedValue(mockResult) };
    mockSpan = createMockSpan();
    mockTracer = createMockTracer(mockSpan);
    mockMetrics = createMockMetrics();
    runner = new ObservedAgentRunner(mockInner, mockTracer, mockMetrics);
  });

  it('should delegate to inner runner and return result', async () => {
    const result = await runner.run({
      systemPrompt: 'test',
      userPrompt: 'investigate',
      tools: [],
      toolHandler: async () => '',
    });

    expect(result).toEqual(mockResult);
    expect(mockInner.run).toHaveBeenCalledOnce();
  });

  it('should record span attributes on success', async () => {
    await runner.run({
      systemPrompt: 'test',
      userPrompt: 'investigate',
      tools: [],
      toolHandler: async () => '',
    });

    expect(mockSpan.setAttribute).toHaveBeenCalledWith('turns', 3);
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('toolCalls', 1);
    expect(mockSpan.setInput).toHaveBeenCalled();
    expect(mockSpan.setUsage).toHaveBeenCalledWith({
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 200,
      outputTokens: 100,
    });
    expect(mockSpan.setOutput).toHaveBeenCalled();
    expect(mockSpan.setStatus).toHaveBeenCalledWith('ok');
    expect(mockSpan.end).toHaveBeenCalled();
  });

  it('should record metrics on success', async () => {
    await runner.run({
      systemPrompt: 'test',
      userPrompt: 'investigate',
      tools: [],
      toolHandler: async () => '',
    });

    expect(mockMetrics.increment).toHaveBeenCalledWith('agent.runs', 1, expect.any(Object));
    expect(mockMetrics.gauge).toHaveBeenCalledWith('agent.turns', 3, expect.any(Object));
    expect(mockMetrics.increment).toHaveBeenCalledWith('agent.tool_calls', 1, expect.any(Object));
  });

  it('should handle errors properly', async () => {
    vi.mocked(mockInner.run).mockRejectedValueOnce(new Error('Runner failed'));

    await expect(
      runner.run({
        systemPrompt: 'test',
        userPrompt: 'investigate',
        tools: [],
        toolHandler: async () => '',
      }),
    ).rejects.toThrow('Runner failed');

    expect(mockSpan.setStatus).toHaveBeenCalledWith('error', 'Runner failed');
    expect(mockMetrics.increment).toHaveBeenCalledWith('agent.errors', 1, expect.any(Object));
    expect(mockSpan.end).toHaveBeenCalled();
  });
});
