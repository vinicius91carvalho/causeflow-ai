import type { DriverCommand } from '../drivers/driver.port.js';

export interface PolicyInput {
  tenantId: string;
  resourceId: string;
  command: DriverCommand;
  requestId: string;
  incidentId?: string;
  principal?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
  clampRowLimit?: number;
}

export interface IPolicyEvaluator {
  evaluate(input: PolicyInput): Promise<PolicyDecision>;
}
