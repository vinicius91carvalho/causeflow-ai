import type { LLMClient, CompletionParams, CompletionResult } from '../../../src/shared/application/ports/llm-client.port.js';

export interface ScenarioResponse {
  triage?: {
    severity: string;
    suggestedAgents: string[];
    summary: string;
  };
  synthesis?: {
    rootCause: string;
    recommendedActions: Array<{ action: string; params: Record<string, unknown> }>;
    findings: string[];
  };
  extraction?: {
    rootCause: { description: string; category: string };
    fix: { description: string; steps: string[] };
    symptoms: string[];
  };
}

const DEFAULT_TRIAGE = {
  severity: 'critical',
  suggestedAgents: ['log_analyst', 'metric_analyst', 'infra_inspector'],
  summary: 'Service experiencing critical issues requiring immediate investigation',
};

const DEFAULT_SYNTHESIS = {
  rootCause: 'OOM memory exceeded — container killed by kernel OOM killer',
  recommendedActions: [
    { action: 'restart_service', params: { service: 'payment-service', cluster: 'production' } },
    { action: 'scale_service', params: { service: 'payment-service', cluster: 'production', desiredCount: 3 } },
  ],
  findings: [
    'Memory utilization reached 95% before OOM kill',
    'Container was restarted by ECS task manager',
    'GC pause times exceeded 5 seconds before crash',
  ],
};

const DEFAULT_EXTRACTION = {
  rootCause: { description: 'OOM memory exceeded', category: 'capacity' },
  fix: { description: 'Increase memory limits and optimize GC', steps: ['Increase task memory to 2048MB', 'Enable GC tuning flags'] },
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
    if (lower.includes('synthesi') || lower.includes('root cause') || lower.includes('investigation results')) {
      return 'synthesis';
    }
    if (lower.includes('extract') || lower.includes('pattern')) {
      return 'extraction';
    }
    return 'unknown';
  }
}
