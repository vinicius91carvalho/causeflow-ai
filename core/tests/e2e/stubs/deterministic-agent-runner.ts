import type { AgentRunner, AgentRunConfig, AgentRunResult, ToolCallRecord } from '../../../src/shared/application/ports/agent-runner.port.js';

export interface AgentResponseOverride {
  response: string;
  toolCallsToMake?: Array<{ name: string; input: Record<string, unknown> }>;
  toolOutputs?: Record<string, string>;
}

const KNOWN_ROLES = [
  'change_detector',
  'db_analyst',
  'code_analyzer',
  'metric_analyst',
  'log_analyst',
  'infra_inspector',
  'scout',
  'orchestrator',
  'issue_correlator',
  'apm_analyst',
  'notification_sender',
  'diagnosis_verifier',
] as const;

const DEFAULT_TOOL_CALLS: Record<string, Array<{ name: string; input: Record<string, unknown> }>> = {
  log_analyst: [
    {
      name: 'aws_api_call',
      input: { service: 'logs', action: 'FilterLogEvents', params: { logGroupName: '/ecs/payment-service' } },
    },
  ],
  metric_analyst: [
    {
      name: 'aws_api_call',
      input: { service: 'cloudwatch', action: 'GetMetricData', params: { MetricName: 'MemoryUtilization' } },
    },
  ],
  infra_inspector: [
    {
      name: 'aws_api_call',
      input: { service: 'ecs', action: 'DescribeServices', params: { cluster: 'production', services: ['payment-service'] } },
    },
  ],
  change_detector: [
    {
      name: 'aws_api_call',
      input: { service: 'ecs', action: 'DescribeServices', params: { cluster: 'production', services: ['payment-service'] } },
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
    const combinedPrompt = [
      config.systemPrompt,
      config.staticSystemPrompt ?? '',
      config.userPrompt,
    ].join(' ');
    const role = this.inferRole(combinedPrompt);
    const override = this.overrides.get(role);

    const toolCallsToMake = override?.toolCallsToMake ?? DEFAULT_TOOL_CALLS[role] ?? [];
    if (toolCallsToMake.length === 0 && config.tools.length > 0) {
      for (const tool of config.tools) {
        toolCallsToMake.push({ name: tool.name, input: {} });
      }
    }
    const response = override?.response ?? DEFAULT_RESPONSES[role] ?? `Analysis complete for role: ${role}`;

    const toolCalls: ToolCallRecord[] = [];
    for (const call of toolCallsToMake) {
      let output = override?.toolOutputs?.[call.name];
      if (!output) {
        if (this.useSyntheticOutput(call.name, override)) {
          output = this.syntheticToolOutput(call.name, call.input);
        } else {
          try {
            const handlerResult = await config.toolHandler(call.name, call.input);
            if (handlerResult != null && !handlerResult.startsWith('Error:')) {
              output = handlerResult;
            }
          } catch {
            // Fall through to synthetic OSS stub output.
          }
        }
      }
      output ??= this.syntheticToolOutput(call.name, call.input);
      toolCalls.push({
        name: call.name,
        input: call.input,
        output: output ?? JSON.stringify({ ok: true, tool: call.name }),
      });
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
    for (const role of KNOWN_ROLES) {
      if (lower.includes(role)) return role;
      if (lower.includes(role.replace(/_/g, ' '))) return role;
    }
    if (lower.includes('change') && lower.includes('detect')) return 'change_detector';
    if (lower.includes('metric') && lower.includes('analy')) return 'metric_analyst';
    if (lower.includes('infra') && lower.includes('inspect')) return 'infra_inspector';
    if (lower.includes('log') && lower.includes('analy')) return 'log_analyst';
    if (lower.includes('code') && lower.includes('analy')) return 'code_analyzer';
    if (lower.includes('database') && lower.includes('analy')) return 'db_analyst';
    return 'unknown';
  }

  private useSyntheticOutput(name: string, override?: AgentResponseOverride): boolean {
    const syntheticOnly = [
      'get_recent_changes',
      'get_commit_diff',
      'get_file_content',
      'get_recent_commits',
      'get_deployments',
      'query_logs',
      'query_metrics',
      'describe_service',
    ];
    if (!syntheticOnly.includes(name)) return false;
    return override?.toolCallsToMake?.some((t) => t.name === name) ?? false;
  }

  private syntheticToolOutput(name: string, input: Record<string, unknown>): string | undefined {
    switch (name) {
      case 'get_commit_diff':
        return JSON.stringify({
          files: [{
            patch: '+  // N+1 query pattern\n+  for (const payment of payments) {\n+    await db.orders.findByPaymentId(payment.id);\n+  }',
          }],
        });
      case 'get_file_content':
        return JSON.stringify({
          path: String(input['path'] ?? 'src/config.ts'),
          content: 'export const requestTimeoutMs = 3000;\n// config regression typo',
        });
      case 'get_recent_changes':
      case 'get_recent_commits':
        return JSON.stringify([
          {
            sha: 'e5f6g7h8',
            message: 'feat: add payment result caching for faster lookups',
            date: '2026-02-14T10:00:00Z',
          },
        ]);
      case 'get_deployments':
        return JSON.stringify([
          { id: 'dep-1', environment: 'production', status: 'success' },
        ]);
      case 'query_logs':
      case 'query_metrics':
      case 'describe_service':
      case 'aws_api_call':
        return JSON.stringify({ ok: true, tool: name, input });
      default:
        return undefined;
    }
  }
}
