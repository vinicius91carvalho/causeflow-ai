import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicAgentRunner } from '../../../../src/shared/infra/llm/anthropic-agent-runner.js';
import type { ToolDefinition } from '../../../../src/shared/application/ports/agent-runner.port.js';

function createMockRunner(messages: Array<Record<string, unknown>>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const msg of messages) {
        yield msg;
      }
    },
    async runUntilDone() {
      return messages[messages.length - 1];
    },
    async done() {
      return messages[messages.length - 1];
    },
    then(onfulfilled: (value: unknown) => unknown) {
      return this.runUntilDone().then(onfulfilled);
    },
  };
}

const toolRunnerMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: vi.fn() },
      beta: {
        messages: {
          toolRunner: toolRunnerMock,
        },
      },
    })),
  };
});

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    anthropic: {
      apiKey: 'test-key',
      baseUrl: undefined,
      investigationModel: 'claude-sonnet-4-5-20250929',
    },
  },
}));

const MOCK_TOOLS: ToolDefinition[] = [
  {
    name: 'query_logs',
    description: 'Query logs',
    inputSchema: {
      type: 'object',
      properties: { service: { type: 'string' } },
      required: ['service'],
    },
  },
];

describe('AnthropicAgentRunner', () => {
  let runner: AnthropicAgentRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = new AnthropicAgentRunner();
  });

  it('should return response directly when no tool_use', async () => {
    toolRunnerMock.mockReturnValueOnce(
      createMockRunner([
        {
          content: [{ type: 'text', text: 'Analysis complete: high CPU caused by memory leak' }],
          usage: { input_tokens: 100, output_tokens: 50 },
          model: 'claude-sonnet-4-5-20250929',
        },
      ]),
    );

    const result = await runner.run({
      systemPrompt: 'You are an SRE analyst',
      userPrompt: 'Investigate the incident',
      tools: MOCK_TOOLS,
      toolHandler: vi.fn(),
    });

    expect(result.response).toBe('Analysis complete: high CPU caused by memory leak');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.turns).toBe(1);
    expect(result.totalUsage).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(result.model).toBe('claude-sonnet-4-5-20250929');
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('should track tool calls via run functions', async () => {
    // The toolRunner calls tool.run() internally. We simulate the runner
    // yielding messages and the tool handler being called via the run function.
    let capturedTools: Array<{ name: string; run: (input: Record<string, unknown>) => Promise<string> }> = [];

    toolRunnerMock.mockImplementationOnce((params: Record<string, unknown>) => {
      capturedTools = params['tools'] as typeof capturedTools;

      return {
        async *[Symbol.asyncIterator]() {
          // Simulate: first message is tool_use, tool.run() gets called, then final text
          // The tool.run() was called externally by the runner, so we invoke it here
          if (capturedTools[0]) {
            await capturedTools[0].run({ service: 'api-server' });
          }

          yield {
            content: [{ type: 'tool_use', id: 't1', name: 'query_logs', input: { service: 'api-server' } }],
            usage: { input_tokens: 80, output_tokens: 40 },
            model: 'claude-sonnet-4-5-20250929',
          };
          yield {
            content: [{ type: 'text', text: 'Found error: OOM kill at 14:32 UTC' }],
            usage: { input_tokens: 200, output_tokens: 60 },
            model: 'claude-sonnet-4-5-20250929',
          };
        },
      };
    });

    const toolHandler = vi.fn().mockResolvedValue('[{"timestamp":"2024-01-01","message":"OOM"}]');

    const result = await runner.run({
      systemPrompt: 'Analyze logs',
      userPrompt: 'Check api-server',
      tools: MOCK_TOOLS,
      toolHandler,
    });

    expect(toolHandler).toHaveBeenCalledWith('query_logs', { service: 'api-server' });
    expect(result.response).toBe('Found error: OOM kill at 14:32 UTC');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toEqual({
      name: 'query_logs',
      input: { service: 'api-server' },
      output: '[{"timestamp":"2024-01-01","message":"OOM"}]',
    });
    expect(result.turns).toBe(2);
    expect(result.totalUsage).toEqual({ inputTokens: 280, outputTokens: 100 });
  });

  it('should track tool handler errors', async () => {
    let capturedTools: Array<{ name: string; run: (input: Record<string, unknown>) => Promise<string> }> = [];

    toolRunnerMock.mockImplementationOnce((params: Record<string, unknown>) => {
      capturedTools = params['tools'] as typeof capturedTools;

      return {
        async *[Symbol.asyncIterator]() {
          // Tool execution with error
          try {
            if (capturedTools[0]) {
              await capturedTools[0].run({ service: 'bad' });
            }
          } catch {
            // Runner catches error and continues
          }

          yield {
            content: [{ type: 'text', text: 'Tool failed, proceeding with available data' }],
            usage: { input_tokens: 100, output_tokens: 40 },
            model: 'claude-sonnet-4-5-20250929',
          };
        },
      };
    });

    const toolHandler = vi.fn().mockRejectedValue(new Error('Service not found'));

    const result = await runner.run({
      systemPrompt: 'Analyze',
      userPrompt: 'Check',
      tools: MOCK_TOOLS,
      toolHandler,
    });

    expect(result.toolCalls[0]!.output).toBe('Service not found');
    expect(result.response).toBe('Tool failed, proceeding with available data');
  });

  it('should accumulate usage across multiple messages', async () => {
    toolRunnerMock.mockReturnValueOnce(
      createMockRunner([
        {
          content: [{ type: 'tool_use', id: 't1', name: 'query_logs', input: { service: 'a' } }],
          usage: { input_tokens: 100, output_tokens: 50 },
          model: 'claude-sonnet-4-5-20250929',
        },
        {
          content: [{ type: 'tool_use', id: 't2', name: 'query_logs', input: { service: 'b' } }],
          usage: { input_tokens: 200, output_tokens: 60 },
          model: 'claude-sonnet-4-5-20250929',
        },
        {
          content: [{ type: 'text', text: 'Done' }],
          usage: { input_tokens: 300, output_tokens: 70 },
          model: 'claude-sonnet-4-5-20250929',
        },
      ]),
    );

    const result = await runner.run({
      systemPrompt: 'Analyze',
      userPrompt: 'Check',
      tools: MOCK_TOOLS,
      toolHandler: vi.fn().mockResolvedValue('{}'),
    });

    expect(result.totalUsage).toEqual({ inputTokens: 600, outputTokens: 180 });
    expect(result.turns).toBe(3);
    expect(result.model).toBe('claude-sonnet-4-5-20250929');
  });

  it('should pass max_iterations to toolRunner', async () => {
    toolRunnerMock.mockReturnValueOnce(
      createMockRunner([
        {
          content: [{ type: 'text', text: 'Quick response' }],
          usage: { input_tokens: 50, output_tokens: 20 },
          model: 'claude-sonnet-4-5-20250929',
        },
      ]),
    );

    await runner.run({
      systemPrompt: 'Analyze',
      userPrompt: 'Check',
      tools: MOCK_TOOLS,
      toolHandler: vi.fn(),
      maxTurns: 3,
    });

    expect(toolRunnerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        max_iterations: 3,
      }),
    );
  });
});
