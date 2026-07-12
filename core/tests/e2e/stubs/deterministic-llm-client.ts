import type {
  LLMClient,
  CompletionParams,
  CompletionResult,
} from '../../../src/shared/application/ports/llm-client.port.js';

export interface ScenarioResponse {
  triage?: {
    priority: string;
    suggestedAgents: string[];
    summary: string;
    investigationMode?: string;
    confidence?: number;
    category?: string;
  };
  synthesis?: {
    potentialRootCause: string;
    recommendedActions: Array<{
      action: string;
      label?: string;
      description?: string;
      rationale?: string;
      riskLevel?: string;
      estimatedDuration?: string;
      automated?: boolean;
      params: Record<string, unknown>;
    }>;
    findings: Array<{ text: string; evidenceIds: string[] }>;
    customerExplanation?: { summary: string; impact: string; resolution: string; eta?: string };
  };
  extraction?: {
    rootCause: { description: string; category: string };
    fix: { description: string; steps: string[] };
    symptoms: string[];
  };
}

const DEFAULT_TRIAGE: Record<string, unknown> = {
  priority: 'critical',
  suggestedAgents: ['log_analyst', 'metric_analyst', 'infra_inspector'],
  summary: 'Service experiencing critical issues requiring immediate investigation',
  investigationMode: 'orchestrator',
  confidence: 0.95,
  category: 'infrastructure',
};

const DEFAULT_SYNTHESIS: Record<string, unknown> = {
  potentialRootCause: 'OOM memory exceeded — container killed by kernel OOM killer',
  recommendedActions: [
    {
      action: 'restart_service',
      label: 'Restart Payment Service',
      description: 'Restart the payment-service ECS service',
      rationale: 'Container was OOM-killed and needs restart',
      riskLevel: 'low',
      estimatedDuration: '2 minutes',
      automated: true,
      params: { service: 'payment-service', cluster: 'production' },
    },
    {
      action: 'scale_service',
      label: 'Scale Payment Service',
      description: 'Increase desired count for payment-service',
      rationale: 'Scaling provides redundancy after OOM incident',
      riskLevel: 'low',
      estimatedDuration: '1 minute',
      automated: true,
      params: { service: 'payment-service', cluster: 'production', desiredCount: 3 },
    },
  ],
  findings: [
    { text: 'Memory utilization reached 95% before OOM kill', evidenceIds: ['ev-1'] },
    { text: 'Container was restarted by ECS task manager', evidenceIds: ['ev-2'] },
    { text: 'GC pause times exceeded 5 seconds before crash', evidenceIds: ['ev-3'] },
  ],
  customerExplanation: {
    summary: 'Memory leak caused OOM kill',
    impact: 'Payment service was unavailable for 2 minutes',
    resolution: 'Service was restarted and memory limits increased',
  },
};

const DEFAULT_EXTRACTION = {
  rootCause: { description: 'OOM memory exceeded', category: 'capacity' },
  fix: {
    description: 'Increase memory limits and optimize GC',
    steps: ['Increase task memory to 2048MB', 'Enable GC tuning flags'],
  },
  symptoms: ['oom_kill', 'memory_spike', 'gc_pause'],
};

export class DeterministicLLMClient implements LLMClient {
  private scenario: ScenarioResponse = {};
  private callLog: Array<{ type: string; params: CompletionParams }> = [];

  setScenario(scenario: ScenarioResponse): void {
    this.scenario = scenario;
  }

  getCallLog(): Array<{ type: string; params: CompletionParams }> {
    return this.callLog;
  }

  reset(): void {
    this.scenario = {};
    this.callLog = [];
  }

  async complete<T>(params: CompletionParams): Promise<CompletionResult<T>> {
    const callType = this.detectCallType(params.systemPrompt);
    this.callLog.push({ type: callType, params });

    let content: unknown;

    switch (callType) {
      case 'triage':
        content = this.scenario.triage ?? DEFAULT_TRIAGE;
        break;
      case 'synthesis':
        content = this.scenario.synthesis ?? DEFAULT_SYNTHESIS;
        break;
      case 'extraction':
        content = this.scenario.extraction ?? DEFAULT_EXTRACTION;
        break;
      default:
        content = { result: 'stub response' };
    }

    if (params.responseSchema) {
      try {
        content = params.responseSchema.parse(content);
      } catch {
        // If schema validation fails, return as-is (the test should catch this)
      }
    }

    return {
      content: content as T,
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'stub-model',
      costUsd: 0,
    };
  }

  private detectCallType(systemPrompt: string): string {
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
}
