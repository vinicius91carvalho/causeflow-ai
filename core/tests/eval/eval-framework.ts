import type { RawAlert } from '../../src/shared/application/ports/alert-source.port.js';

export interface EvalScenario {
  name: string;
  alertPayload: RawAlert;
  expectedRootCause: string;
  expectedSeverity: string;
  expectedActions: string[];
  acceptableAgents: string[];
  minConfidence: number;
  codeScenario?: string;
}

export interface EvalResult {
  scenario: string;
  triageAccuracy: number;
  rootCauseMatch: boolean;
  actionsMatch: number;
  totalLatencyMs: number;
  totalCostUsd: number;
  passed: boolean;
}

export function scoreRootCause(actual: string, expected: string): boolean {
  const actualLower = actual.toLowerCase();
  const expectedKeywords = expected.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  if (expectedKeywords.length === 0) return true;

  const matchCount = expectedKeywords.filter((kw) => actualLower.includes(kw)).length;
  const matchRatio = matchCount / expectedKeywords.length;

  return matchRatio >= 0.6;
}

export function scoreActions(actual: Array<{ action: string }>, expected: string[]): number {
  if (expected.length === 0) return 1;

  const actualActions = actual.map((a) => a.action.toLowerCase());
  const matchCount = expected.filter((e) =>
    actualActions.some((a) => a.includes(e.toLowerCase())),
  ).length;

  return matchCount / expected.length;
}

export function scoreTriageSeverity(actual: string, expected: string): number {
  if (actual === expected) return 1;

  const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];
  const actualIdx = severityOrder.indexOf(actual);
  const expectedIdx = severityOrder.indexOf(expected);

  if (actualIdx === -1 || expectedIdx === -1) return 0;

  const distance = Math.abs(actualIdx - expectedIdx);
  return Math.max(0, 1 - distance * 0.25);
}

export function evaluateResult(
  scenario: EvalScenario,
  result: {
    severity: string;
    rootCause: string;
    actions: Array<{ action: string }>;
    latencyMs: number;
    costUsd: number;
  },
): EvalResult {
  const triageAccuracy = scoreTriageSeverity(result.severity, scenario.expectedSeverity);
  const rootCauseMatch = scoreRootCause(result.rootCause, scenario.expectedRootCause);
  const actionsMatch = scoreActions(result.actions, scenario.expectedActions);

  return {
    scenario: scenario.name,
    triageAccuracy,
    rootCauseMatch,
    actionsMatch,
    totalLatencyMs: result.latencyMs,
    totalCostUsd: result.costUsd,
    passed: triageAccuracy >= 0.75 && rootCauseMatch && actionsMatch >= 0.5,
  };
}
