import type { AgentRunner, AgentRunConfig, AgentRunResult, ToolCallRecord } from '../../../src/shared/application/ports/agent-runner.port.js';

export interface AgentResponseOverride {
  response: string;
  toolCallsToMake?: Array<{ name: string; input: Record<string, unknown> }>;
}

const DEFAULT_TOOL_CALLS: Record<string, Array<{ name: string; input: Record<string, unknown> }>> = {
  log_analyst: [
    {
      name: 'query_logs',
      input: {
        service: 'payment-service',
        filter: 'error',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date().toISOString(),
        limit: 20,
      },
    },
  ],
  metric_analyst: [
    {
      name: 'query_metrics',
      input: {
        metricName: 'MemoryUtilization',
        namespace: 'AWS/ECS',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date().toISOString(),
        period: 60,
        stat: 'Average',
      },
    },
  ],
  infra_inspector: [
    {
      name: 'describe_service',
      input: { serviceName: 'payment-service', region: 'us-east-1' },
    },
  ],
  change_detector: [
    {
      name: 'describe_service',
      input: { serviceName: 'payment-service', region: 'us-east-1' },
    },
    {
      name: 'get_recent_changes',
      input: { service: 'payment-service' },
    },
  ],
};

const DEFAULT_RESPONSES: Record<string, string> = {
  log_analyst: 'Log analysis complete: Found OOM kill events and memory pressure warnings. Container was killed by kernel OOM killer at 95% memory utilization.',
  metric_analyst: 'Metric analysis complete: MemoryUtilization reached 95% before crash. Steady increase from 60% baseline over 30 minutes. GC pause times exceeded 5s.',
  infra_inspector: 'Infrastructure inspection: ECS service payment-service running in cluster production. 2 desired tasks, currently 2 running. Task definition uses 512 CPU / 1024 memory.',
  change_detector: 'Change detection: No recent deployments found. Service configuration unchanged in last 24 hours. Issue appears to be a gradual memory leak.',
};

export class DeterministicAgentRunner implements AgentRunner {
  private overrides = new Map<string, AgentResponseOverride>();
  private runLog: Array<{ role: string; config: AgentRunConfig; toolCalls: ToolCallRecord[] }> = [];

  setAgentResponse(role: string, override: AgentResponseOverride): void {
    this.overrides.set(role, override);
  }

  getRunLog(): Array<{ role: string; config: AgentRunConfig; toolCalls: ToolCallRecord[] }> {
    return this.runLog;
  }

  reset(): void {
    this.overrides.clear();
    this.runLog = [];
  }

  async run(config: AgentRunConfig): Promise<AgentRunResult> {
    const role = this.inferRole(config.systemPrompt);
    const override = this.overrides.get(role);

    const toolCallsToMake = override?.toolCallsToMake ?? DEFAULT_TOOL_CALLS[role] ?? [];
    const response = override?.response ?? DEFAULT_RESPONSES[role] ?? `Analysis complete for role: ${role}`;

    // Actually call the tool handler to exercise the real CloudProvider integration
    const toolCalls: ToolCallRecord[] = [];
    for (const call of toolCallsToMake) {
      try {
        const output = await config.toolHandler(call.name, call.input);
        toolCalls.push({ name: call.name, input: call.input, output });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Tool call failed';
        toolCalls.push({ name: call.name, input: call.input, output: `Error: ${errorMsg}` });
      }
    }

    this.runLog.push({ role, config, toolCalls });

    return {
      response,
      toolCalls,
      totalUsage: { inputTokens: 500, outputTokens: 200 },
      turns: toolCalls.length + 1,
      model: 'stub-agent-model',
      costUsd: 0,
    };
  }

  private inferRole(systemPrompt: string): string {
    const lower = systemPrompt.toLowerCase();
    if (lower.includes('log') && lower.includes('analy')) return 'log_analyst';
    if (lower.includes('metric') && lower.includes('analy')) return 'metric_analyst';
    if (lower.includes('infra') && lower.includes('inspect')) return 'infra_inspector';
    if (lower.includes('change') && lower.includes('detect')) return 'change_detector';
    return 'unknown';
  }
}
