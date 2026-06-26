import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicPTCAgentRunner } from '../../../../src/shared/infra/llm/anthropic-ptc-agent-runner.js';
import type { AgentRunConfig } from '../../../../src/shared/application/ports/agent-runner.port.js';

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      beta = {
        messages: {
          create: mockCreate,
        },
      };
    },
  };
});

// Mock config
vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    anthropic: {
      apiKey: 'test-key',
      baseUrl: undefined,
      investigationModel: 'claude-sonnet-4-5-20250929',
    },
  },
}));

describe('AnthropicPTCAgentRunner', () => {
  let runner: AnthropicPTCAgentRunner;

  beforeEach(() => {
    mockCreate.mockReset();
    runner = new AnthropicPTCAgentRunner();
  });

  it('should handle end_turn with text response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Analysis complete: root cause is OOM.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
      model: 'claude-sonnet-4-5-20250929',
      container: null,
    });

    const config: AgentRunConfig = {
      systemPrompt: 'You are an SRE agent.',
      userPrompt: 'Investigate incident inc-1',
      tools: [],
      toolHandler: vi.fn(),
    };

    const result = await runner.run(config);

    expect(result.response).toContain('root cause is OOM');
    expect(result.turns).toBe(1);
    expect(result.totalUsage.inputTokens).toBe(100);
    expect(result.totalUsage.outputTokens).toBe(50);
    expect(result.toolCalls).toHaveLength(0);
  });

  it('should handle tool_use → tool_result → end_turn loop', async () => {
    // Turn 1: model requests tool use
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Let me check the service.' },
        { type: 'tool_use', id: 'tool-1', name: 'aws_api_call', input: { service: 'ecs', action: 'DescribeServices', params: {} } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 100, output_tokens: 60 },
      model: 'claude-sonnet-4-5-20250929',
      container: { id: 'container-123', expires_at: '2024-01-01T01:00:00Z', skills: null },
    });

    // Turn 2: model produces final response
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Service is healthy with 3 tasks running.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 200, output_tokens: 40 },
      model: 'claude-sonnet-4-5-20250929',
      container: { id: 'container-123', expires_at: '2024-01-01T01:00:00Z', skills: null },
    });

    const toolHandler = vi.fn().mockResolvedValue(JSON.stringify({ services: [{ status: 'ACTIVE' }] }));

    const config: AgentRunConfig = {
      systemPrompt: 'You are an SRE agent.',
      userPrompt: 'Investigate incident inc-1',
      tools: [{
        name: 'aws_api_call',
        description: 'Call AWS API',
        inputSchema: { type: 'object', properties: {} },
      }],
      toolHandler,
    };

    const result = await runner.run(config);

    expect(result.turns).toBe(2);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe('aws_api_call');
    expect(result.totalUsage.inputTokens).toBe(300);
    expect(result.totalUsage.outputTokens).toBe(100);
    expect(result.response).toContain('Let me check');
    expect(result.response).toContain('3 tasks running');

    // Verify tool handler was called
    expect(toolHandler).toHaveBeenCalledWith('aws_api_call', { service: 'ecs', action: 'DescribeServices', params: {} });

    // Verify container was reused in the second call
    const secondCall = mockCreate.mock.calls[1]![0] as Record<string, unknown>;
    expect(secondCall['container']).toBe('container-123');
  });

  it('should handle tool errors gracefully', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'aws_api_call', input: { service: 'rds', action: 'DescribeDBInstances' } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 50, output_tokens: 30 },
      model: 'claude-sonnet-4-5-20250929',
      container: null,
    });

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Unable to query RDS.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 20 },
      model: 'claude-sonnet-4-5-20250929',
      container: null,
    });

    const toolHandler = vi.fn().mockRejectedValue(new Error('Access denied'));

    const config: AgentRunConfig = {
      systemPrompt: 'agent',
      userPrompt: 'check db',
      tools: [{ name: 'aws_api_call', description: 'Call AWS', inputSchema: { type: 'object' } }],
      toolHandler,
    };

    const result = await runner.run(config);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.output).toBe('Access denied');
    expect(result.response).toContain('Unable to query RDS');
  });

  it('should include code_execution tool when useCodeExecution is true', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Done' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 50, output_tokens: 10 },
      model: 'claude-sonnet-4-5-20250929',
      container: null,
    });

    const config: AgentRunConfig = {
      systemPrompt: 'agent',
      userPrompt: 'investigate',
      tools: [{ name: 'aws_api_call', description: 'Call AWS', inputSchema: { type: 'object' } }],
      toolHandler: vi.fn(),
      useCodeExecution: true,
    };

    await runner.run(config);

    const createCall = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    const tools = createCall['tools'] as Array<{ type: string; name: string }>;
    expect(tools).toHaveLength(2);
    expect(tools.some(t => t.type === 'code_execution_20250522')).toBe(true);
  });

  it('should not exceed maxTurns', async () => {
    // Always return tool_use to force looping
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'tool-x', name: 'aws_api_call', input: { service: 'ecs', action: 'DescribeServices' } }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 10 },
      model: 'claude-sonnet-4-5-20250929',
      container: null,
    });

    const config: AgentRunConfig = {
      systemPrompt: 'agent',
      userPrompt: 'check',
      tools: [{ name: 'aws_api_call', description: 'Call AWS', inputSchema: { type: 'object' } }],
      toolHandler: vi.fn().mockResolvedValue('{}'),
      maxTurns: 3,
    };

    const result = await runner.run(config);
    expect(result.turns).toBe(3);
  });

  it('should handle pause_turn by continuing', async () => {
    // Turn 1: pause
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Analyzing...' }],
      stop_reason: 'pause_turn',
      usage: { input_tokens: 50, output_tokens: 20 },
      model: 'claude-sonnet-4-5-20250929',
      container: null,
    });

    // Turn 2: end
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Done analyzing.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 30 },
      model: 'claude-sonnet-4-5-20250929',
      container: null,
    });

    const config: AgentRunConfig = {
      systemPrompt: 'agent',
      userPrompt: 'investigate',
      tools: [],
      toolHandler: vi.fn(),
    };

    const result = await runner.run(config);
    expect(result.turns).toBe(2);
    expect(result.response).toContain('Analyzing');
    expect(result.response).toContain('Done analyzing');
  });
});
