import { describe, it, expect } from 'vitest';
import { buildSessionPolicy } from '../../../../src/shared/infra/credentials/role-policy-builder.js';

describe('buildSessionPolicy', () => {
  it('should return broad read-only policy for log_analyst', () => {
    const policy = JSON.parse(buildSessionPolicy('log_analyst'));
    const actions = policy.Statement[0].Action as string[];
    // All investigation agents get the same broad read-only policy
    expect(actions.some((a: string) => a.startsWith('logs:'))).toBe(true);
    expect(actions.some((a: string) => a.startsWith('cloudwatch:'))).toBe(true);
    expect(actions.some((a: string) => a.startsWith('ecs:'))).toBe(true);
  });

  it('should return broad read-only policy for metric_analyst', () => {
    const policy = JSON.parse(buildSessionPolicy('metric_analyst'));
    const actions = policy.Statement[0].Action as string[];
    expect(actions.some((a: string) => a.startsWith('cloudwatch:'))).toBe(true);
    expect(actions).toContain('cloudwatch:Get*');
  });

  it('should return describe-only policy for infra_inspector', () => {
    const policy = JSON.parse(buildSessionPolicy('infra_inspector'));
    const actions = policy.Statement[0].Action as string[];
    expect(actions.some((a: string) => a.includes('Describe'))).toBe(true);
    // DenyDestructive statement should block writes
    const statements = policy.Statement as Array<{ Sid?: string; Action: string[] }>;
    const denyStatement = statements.find((s) => s.Sid === 'DenyDestructive');
    expect(denyStatement).toBeDefined();
    expect(denyStatement?.Action).toContain('ecs:UpdateService');
  });

  it('should return broad read-only policy for change_detector (includes cloudtrail)', () => {
    const policy = JSON.parse(buildSessionPolicy('change_detector'));
    const actions = policy.Statement[0].Action as string[];
    // change_detector gets same investigation policy which includes cloudtrail
    expect(actions).toContain('cloudtrail:Lookup*');
  });

  it('should return write permissions for remediator', () => {
    const policy = JSON.parse(buildSessionPolicy('remediator'));
    const actions = policy.Statement[0].Action as string[];
    expect(actions).toContain('ecs:UpdateService');
    expect(actions).toContain('ssm:SendCommand');
    expect(actions).toContain('ssm:GetCommandInvocation');
  });

  it('should return minimal policy for coordinator', () => {
    const policy = JSON.parse(buildSessionPolicy('coordinator'));
    const actions = policy.Statement[0].Action as string[];
    expect(actions).toContain('sts:GetCallerIdentity');
    expect(actions).toHaveLength(1);
  });

  it('should return investigation read-only policy for orchestrator', () => {
    const policy = JSON.parse(buildSessionPolicy('orchestrator'));
    const actions = policy.Statement[0].Action as string[];
    // Orchestrator should have broad read access like any investigation agent
    expect(actions.some((a: string) => a.startsWith('logs:'))).toBe(true);
    expect(actions.some((a: string) => a.startsWith('cloudwatch:'))).toBe(true);
    expect(actions.some((a: string) => a.startsWith('ecs:'))).toBe(true);
    expect(actions.some((a: string) => a.startsWith('sqs:'))).toBe(true);
  });

  it('should fallback to investigation policy for unknown roles', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    const policy = JSON.parse(buildSessionPolicy('unknown_role' as any));
    const actions = policy.Statement[0].Action as string[];
    // Unknown roles get the investigation read-only policy (not coordinator)
    expect(actions.length).toBeGreaterThan(1);
  });

  it('should always have Version 2012-10-17', () => {
    const roles = ['log_analyst', 'metric_analyst', 'infra_inspector', 'change_detector', 'remediator', 'coordinator', 'orchestrator'] as const;
    for (const role of roles) {
      const policy = JSON.parse(buildSessionPolicy(role));
      expect(policy.Version).toBe('2012-10-17');
    }
  });

  it('should always have Effect Allow in first statement', () => {
    const roles = ['log_analyst', 'metric_analyst', 'infra_inspector', 'change_detector', 'remediator', 'coordinator', 'orchestrator'] as const;
    for (const role of roles) {
      const policy = JSON.parse(buildSessionPolicy(role));
      expect(policy.Statement[0].Effect).toBe('Allow');
    }
  });

  it('should target all resources (*)', () => {
    const roles = ['log_analyst', 'metric_analyst', 'infra_inspector', 'change_detector', 'remediator', 'coordinator', 'orchestrator'] as const;
    for (const role of roles) {
      const policy = JSON.parse(buildSessionPolicy(role));
      expect(policy.Statement[0].Resource).toBe('*');
    }
  });
});
