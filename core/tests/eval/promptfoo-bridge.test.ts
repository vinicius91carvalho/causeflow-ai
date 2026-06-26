import { describe, it, expect } from 'vitest';
import path from 'node:path';

const API_KEY = process.env['ANTHROPIC_API_KEY'];
const SKIP = !API_KEY || API_KEY === 'stub-api-key-for-e2e';

interface ComponentResult {
  pass: boolean;
  assertion?: { type: string };
  reason?: string;
}

interface GradingResult {
  componentResults?: ComponentResult[];
}

interface EvalResultEntry {
  success: boolean;
  vars?: Record<string, string>;
  response?: { output?: string };
  gradingResult?: GradingResult;
}

describe.skipIf(SKIP)('Promptfoo Triage Eval (Bridge)', () => {
  it('all triage scenarios should pass with haiku', async () => {
    const { evaluate } = await import('promptfoo');

    const providerPath = path.resolve(__dirname, 'promptfoo/providers/triage-provider.ts');

    const results = await evaluate({
      providers: [
        {
          id: `file://${providerPath}`,
          label: 'Haiku 4.5',
          config: { model: 'claude-haiku-4-5-20251001' },
        },
      ],
      prompts: [
        'Incident: {{title}}\nSource: {{source}}\nSeverity from source: {{sourceSeverity}}\nDetails: {{details}}',
      ],
      tests: [
        {
          vars: {
            title: 'payment-service-memory-critical',
            source: 'cloudwatch',
            sourceSeverity: 'critical',
            details: 'Threshold Crossed: MemoryUtilization exceeded 90%. Container OOMKilled. Exit code 137.',
          },
          assert: [
            { type: 'is-json' as const },
            { type: 'javascript' as const, value: "JSON.parse(output).priority === 'critical'" },
            { type: 'javascript' as const, value: "JSON.parse(output).suggestedAgents.includes('log_analyst')" },
            { type: 'javascript' as const, value: 'JSON.parse(output).confidence >= 0.7' },
          ],
        },
        {
          vars: {
            title: 'staging-health-check-recovered',
            source: 'cloudwatch',
            sourceSeverity: 'info',
            details: 'Health check recovered after brief 502. Single data point. Staging environment.',
          },
          assert: [
            { type: 'is-json' as const },
            { type: 'javascript' as const, value: "['info','low'].includes(JSON.parse(output).priority)" },
          ],
        },
      ],
    });

    const evalResults = results.results as unknown as EvalResultEntry[];
    const failedResults = evalResults.filter((r) => !r.success);

    if (failedResults.length > 0) {
      const failures = failedResults.map((r) => ({
        vars: r.vars,
        output: r.response?.output,
        failures: r.gradingResult?.componentResults
          ?.filter((c) => !c.pass)
          .map((c) => ({ assertion: c.assertion?.type, reason: c.reason })),
      }));
      console.error('Failed eval scenarios:', JSON.stringify(failures, null, 2));
    }

    expect(failedResults).toHaveLength(0);
  }, 60_000);
});
