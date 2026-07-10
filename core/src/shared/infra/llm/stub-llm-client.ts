/**
 * Deterministic LLM client for the open-source local runtime when
 * ANTHROPIC_API_KEY is unset. Never imports @anthropic-ai/sdk.
 *
 * Promoted from tests/e2e/stubs/deterministic-llm-client.ts for AC-046.
 */
import type { LLMClient, CompletionParams, CompletionResult } from '../../application/ports/llm-client.port.js';

const DEFAULT_TRIAGE: Record<string, unknown> = {
  priority: 'high',
  suggestedAgents: [
    'log_analyst',
    'metric_analyst',
    'change_detector',
    'code_analyzer',
    'infra_inspector',
    'db_analyst',
  ],
  summary: 'High CPU / connection-pool pressure on order-service — investigate immediately',
  investigationMode: 'orchestrator',
  confidence: 0.9,
  category: 'application',
};

const DEFAULT_SYNTHESIS: Record<string, unknown> = {
  potentialRootCause:
    'Database connection pool exhaustion on order-service under sustained high CPU load',
  recommendedActions: [
    {
      action: 'restart_service',
      label: 'Restart order-service',
      description: 'Restart order-service to clear exhausted connection pools',
      rationale: 'Pool exhaustion leaves the service unable to serve requests until recycled',
      riskLevel: 'low',
      estimatedDuration: '2 minutes',
      automated: true,
      params: { service: 'order-service', cluster: 'local' },
    },
    {
      action: 'scale_service',
      label: 'Scale order-service',
      description: 'Increase desired count for order-service to absorb load',
      rationale: 'Additional tasks reduce per-instance pool pressure',
      riskLevel: 'low',
      estimatedDuration: '1 minute',
      automated: true,
      params: { service: 'order-service', cluster: 'local', desiredCount: 3 },
    },
  ],
  findings: [
    {
      text: 'CPU utilization on order-service sustained above 90% during the alert window',
      evidenceIds: ['ev-stub-cpu'],
    },
    {
      text: 'Database connection pool waiters grew while active connections hit the max',
      evidenceIds: ['ev-stub-pool'],
    },
    {
      text: 'No recent deploy correlated with the onset; issue appears load-driven',
      evidenceIds: ['ev-stub-change'],
    },
  ],
  customerExplanation: {
    summary: 'order-service exhausted its DB connection pool under high CPU',
    impact: 'Elevated error rates and latency for order APIs',
    resolution: 'Restart and scale order-service; raise pool size if recurrence continues',
  },
};

const DEFAULT_EXTRACTION = {
  rootCause: {
    description: 'Database connection pool exhaustion under high CPU',
    category: 'capacity',
  },
  fix: {
    description: 'Restart service and increase connection pool / replica count',
    steps: [
      'Restart order-service',
      'Scale desired count to 3',
      'Raise DB pool max if the pattern recurs',
    ],
  },
  symptoms: ['high_cpu', 'connection_pool_exhaustion', 'elevated_latency'],
};

export class StubLlmClient implements LLMClient {
  async complete<T>(params: CompletionParams): Promise<CompletionResult<T>> {
    const callType = detectCallType(params.systemPrompt);
    let content: unknown;

    switch (callType) {
      case 'triage':
        content = DEFAULT_TRIAGE;
        break;
      case 'synthesis':
        content = DEFAULT_SYNTHESIS;
        break;
      case 'extraction':
        content = DEFAULT_EXTRACTION;
        break;
      default:
        content = {
          result: 'stub llm response',
          summary: 'Deterministic OSS stub response (no Anthropic API key)',
        };
    }

    if (params.responseSchema) {
      try {
        content = params.responseSchema.parse(content);
      } catch {
        // Return unparsed content; callers have their own fallbacks.
      }
    }

    return {
      content: content as T,
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'stub-llm',
      costUsd: 0,
    };
  }
}

function detectCallType(systemPrompt: string): string {
  const lower = systemPrompt.toLowerCase();
  if (lower.includes('triage') || lower.includes('severity') || lower.includes('classify')) {
    return 'triage';
  }
  if (
    lower.includes('synthesi') ||
    lower.includes('root cause') ||
    lower.includes('investigation results')
  ) {
    return 'synthesis';
  }
  if (lower.includes('extract') || lower.includes('pattern')) {
    return 'extraction';
  }
  return 'unknown';
}
