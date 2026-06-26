import type { EvalResult } from '../../eval/eval-framework.js';

const SEPARATOR = '='.repeat(80);
const SUBSEP = '\u2500'.repeat(24);

function statusIcon(passed: boolean): string {
  return passed ? 'PASS' : 'FAIL';
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function usd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function secs(ms: number): string {
  return `${(ms / 1_000).toFixed(1)}s`;
}

export function printEvalReport(results: EvalResult[]): void {
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  const lines: string[] = [
    '',
    SEPARATOR,
    '  CAUSEFLOW SMOKE EVAL REPORT',
    SEPARATOR,
    '',
  ];

  for (const r of results) {
    lines.push(`  [${statusIcon(r.passed)}] ${r.scenario}`);
    lines.push(`  ${SUBSEP}`);
    lines.push(`    Triage Severity  : ${pct(r.triageAccuracy)}`);
    lines.push(`    Root Cause Match : ${r.rootCauseMatch ? 'YES' : 'NO'}`);
    lines.push(`    Actions Match    : ${pct(r.actionsMatch)}`);
    lines.push(`    Latency          : ${secs(r.totalLatencyMs)}`);
    lines.push(`    Cost (USD)       : ${usd(r.totalCostUsd)}`);
    lines.push('');
  }

  const totalCost = results.reduce((sum, r) => sum + r.totalCostUsd, 0);
  const totalTime = results.reduce((sum, r) => sum + r.totalLatencyMs, 0);

  lines.push(SEPARATOR);
  lines.push(`  TOTAL: ${passed}/${total} passed (${pct(passed / (total || 1))})`);
  lines.push(`  Total cost: ${usd(totalCost)} | Total time: ${secs(totalTime)}`);
  lines.push(SEPARATOR);
  lines.push('');

  console.log(lines.join('\n'));
}
