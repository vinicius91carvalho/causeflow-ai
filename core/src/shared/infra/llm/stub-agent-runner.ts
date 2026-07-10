/**
 * Deterministic agent runner for the open-source local runtime when
 * ANTHROPIC_API_KEY is unset. Never imports @anthropic-ai/sdk.
 *
 * Promoted from tests/e2e/stubs/deterministic-agent-runner.ts for AC-046.
 */
import type {
  AgentRunner,
  AgentRunConfig,
  AgentRunResult,
  ToolCallRecord,
} from '../../application/ports/agent-runner.port.js';

const DEFAULT_TOOL_CALLS: Record<string, Array<{ name: string; input: Record<string, unknown> }>> = {
  log_analyst: [
    {
      name: 'query_logs',
      input: {
        service: 'order-service',
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
        metricName: 'CPUUtilization',
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
      input: { serviceName: 'order-service', region: 'us-east-1' },
    },
  ],
  change_detector: [
    {
      name: 'describe_service',
      input: { serviceName: 'order-service', region: 'us-east-1' },
    },
    {
      name: 'get_recent_changes',
      input: { service: 'order-service' },
    },
  ],
  code_analyzer: [
    {
      name: 'code_get_service_repos',
      input: { service: 'order-service' },
    },
  ],
  db_analyst: [
    {
      name: 'db_list_resources',
      input: {},
    },
  ],
};

const DEFAULT_RESPONSES: Record<string, string> = {
  log_analyst:
    'Log analysis complete: order-service shows connection pool wait timeouts and thread-pool saturation under high CPU. Errors correlate with DB checkout failures.\n\n## Summary\n- **Key Finding**: Connection pool exhaustion under CPU pressure\n- **Confidence**: high\n- **Evidence**: pool wait timeouts, checkout failures',
  metric_analyst:
    'Metric analysis complete: CPUUtilization sustained above 90% for order-service. Concurrent DB connections at pool max; queue depth rising.\n\n## Summary\n- **Key Finding**: Sustained high CPU with saturated DB pool\n- **Confidence**: high\n- **Evidence**: CPU>90%, pool at max',
  infra_inspector:
    'Infrastructure inspection: order-service running with 2 desired tasks. Task definition CPU/memory appear undersized for current load.\n\n## Summary\n- **Key Finding**: Capacity undersized for load\n- **Confidence**: medium\n- **Evidence**: desired=2, high CPU',
  change_detector:
    'Change detection: No recent deployments in the last 24h. Configuration unchanged. Issue appears load-driven rather than change-driven.\n\n## Summary\n- **Key Finding**: No correlating deploy\n- **Confidence**: high\n- **Evidence**: empty change window',
  code_analyzer:
    'Code analysis: order-service DB client uses a fixed pool size with no adaptive backoff on checkout failure. Recent code paths amplify connection churn under load.\n\n## Summary\n- **Key Finding**: Fixed pool size without backoff\n- **Confidence**: medium\n- **Evidence**: pool config, retry paths',
  db_analyst:
    'Database analysis: connection waiters spiked while active connections hit the configured maximum. No lock contention on primary tables; pool sizing is the bottleneck.\n\n## Summary\n- **Key Finding**: Pool max reached, waiters growing\n- **Confidence**: high\n- **Evidence**: waiter count, max connections',
};

export class StubAgentRunner implements AgentRunner {
  async run(config: AgentRunConfig): Promise<AgentRunResult> {
    const combinedPrompt =
      config.systemPrompt +
      ' ' +
      (config.staticSystemPrompt ?? '') +
      ' ' +
      config.userPrompt;
    const role = inferRole(combinedPrompt);

    const toolCallsToMake = [...(DEFAULT_TOOL_CALLS[role] ?? [])];
    if (toolCallsToMake.length === 0 && config.tools.length > 0) {
      for (const tool of config.tools.slice(0, 2)) {
        toolCallsToMake.push({ name: tool.name, input: {} });
      }
    }

    const response =
      DEFAULT_RESPONSES[role] ??
      `Analysis complete for role: ${role} (OSS stub — no Anthropic API key)`;

    const toolCalls: ToolCallRecord[] = [];
    for (const call of toolCallsToMake) {
      const toolExists = config.tools.some((t) => t.name === call.name);
      if (!toolExists && config.tools.length > 0) {
        // Fall back to the first available tool so we still exercise the handler.
        const fallback = config.tools[0]!;
        try {
          const output = await config.toolHandler(fallback.name, {});
          toolCalls.push({ name: fallback.name, input: {}, output });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Tool call failed';
          toolCalls.push({ name: fallback.name, input: {}, output: `Error: ${errorMsg}` });
        }
        continue;
      }
      try {
        const output = await config.toolHandler(call.name, call.input);
        toolCalls.push({ name: call.name, input: call.input, output });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Tool call failed';
        toolCalls.push({ name: call.name, input: call.input, output: `Error: ${errorMsg}` });
      }
    }

    return {
      response,
      toolCalls,
      totalUsage: { inputTokens: 500, outputTokens: 200 },
      turns: toolCalls.length + 1,
      model: 'stub-agent',
      costUsd: 0,
    };
  }
}

function inferRole(systemPrompt: string): string {
  const lower = systemPrompt.toLowerCase();
  // Prefer explicit specialist titles (capabilities prompts can mention other domains).
  if (lower.includes('log analysis specialist')) return 'log_analyst';
  if (lower.includes('metric analysis specialist') || lower.includes('metrics analysis specialist')) {
    return 'metric_analyst';
  }
  if (lower.includes('infrastructure inspection specialist') || lower.includes('infrastructure inspector')) {
    return 'infra_inspector';
  }
  if (lower.includes('change detection specialist') || lower.includes('change detector')) {
    return 'change_detector';
  }
  if (lower.includes('code analysis specialist')) return 'code_analyzer';
  if (lower.includes('database investigation specialist')) return 'db_analyst';
  if (lower.includes('change') && (lower.includes('detect') || lower.includes('deploy'))) {
    return 'change_detector';
  }
  if (lower.includes('metric') && lower.includes('analy')) return 'metric_analyst';
  if (lower.includes('infra') && lower.includes('inspect')) return 'infra_inspector';
  if (lower.includes('log') && lower.includes('analy')) return 'log_analyst';
  if (lower.includes('code analysis') || lower.includes('source code')) return 'code_analyzer';
  if (lower.includes('database') || lower.includes('data-layer')) return 'db_analyst';
  if (lower.includes('scout') || lower.includes('first-responder')) return 'scout';
  if (lower.includes('verif') || lower.includes('adversarial')) return 'diagnosis_verifier';
  return 'unknown';
}
