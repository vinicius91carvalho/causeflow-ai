import { describe, expect, it } from 'vitest';
import {
  changeRoleSchema,
  connectIntegrationSchema,
  createAnalysisSchema,
  inviteTeamMemberSchema,
  updateSettingsSchema,
} from '../schemas';

describe('createAnalysisSchema', () => {
  it('accepts valid input', () => {
    const result = createAnalysisSchema.safeParse({
      prompt: 'Why did our database go down at 3am on Friday?',
      severity: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('rejects prompt too short (under 10 chars)', () => {
    const result = createAnalysisSchema.safeParse({ prompt: 'Too short' });
    expect(result.success).toBe(false);
  });

  it('rejects prompt over 4000 chars', () => {
    const result = createAnalysisSchema.safeParse({ prompt: 'a'.repeat(4001) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid severity', () => {
    const result = createAnalysisSchema.safeParse({
      prompt: 'Valid prompt text here',
      severity: 'extreme',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields omitted', () => {
    const result = createAnalysisSchema.safeParse({
      prompt: 'Why did the API start returning 503 errors yesterday afternoon?',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid severity values', () => {
    for (const sev of ['low', 'medium', 'high', 'critical']) {
      const result = createAnalysisSchema.safeParse({
        prompt: 'Valid prompt text here',
        severity: sev,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('connectIntegrationSchema', () => {
  it('accepts slack input (OAuth — no manual fields)', () => {
    const result = connectIntegrationSchema.safeParse({
      type: 'slack',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid datadog input', () => {
    const result = connectIntegrationSchema.safeParse({
      type: 'datadog',
      apiKey: 'dd-api-key',
      applicationKey: 'dd-app-key',
    });
    expect(result.success).toBe(true);
  });

  it('rejects datadog with missing applicationKey', () => {
    const result = connectIntegrationSchema.safeParse({
      type: 'datadog',
      apiKey: 'dd-api-key',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid jira input', () => {
    const result = connectIntegrationSchema.safeParse({
      type: 'jira',
      email: 'user@company.com',
      apiToken: 'jira-token',
      domain: 'https://company.atlassian.net',
    });
    expect(result.success).toBe(true);
  });

  it('rejects jira with invalid email', () => {
    const result = connectIntegrationSchema.safeParse({
      type: 'jira',
      email: 'not-an-email',
      apiToken: 'token',
      domain: 'https://company.atlassian.net',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid cloudwatch input', () => {
    const result = connectIntegrationSchema.safeParse({
      type: 'cloudwatch',
      roleArn: 'arn:aws:iam::123456789012:role/CauseFlowReadOnly',
      externalId: 'ext-id-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects cloudwatch with invalid roleArn', () => {
    const result = connectIntegrationSchema.safeParse({
      type: 'cloudwatch',
      roleArn: 'not-an-arn',
      externalId: 'ext-id-123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown integration type', () => {
    const result = connectIntegrationSchema.safeParse({ type: 'unknown', apiKey: 'key' });
    expect(result.success).toBe(false);
  });
});

describe('inviteTeamMemberSchema', () => {
  it('accepts valid email and role', () => {
    const result = inviteTeamMemberSchema.safeParse({ email: 'user@co.com', role: 'member' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = inviteTeamMemberSchema.safeParse({ email: 'not-an-email', role: 'member' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = inviteTeamMemberSchema.safeParse({ email: 'user@co.com', role: 'superadmin' });
    expect(result.success).toBe(false);
  });

  it('accepts both valid roles', () => {
    expect(inviteTeamMemberSchema.safeParse({ email: 'a@b.com', role: 'admin' }).success).toBe(
      true,
    );
    expect(inviteTeamMemberSchema.safeParse({ email: 'a@b.com', role: 'member' }).success).toBe(
      true,
    );
  });
});

describe('changeRoleSchema', () => {
  it('accepts admin', () => {
    expect(changeRoleSchema.safeParse({ role: 'admin' }).success).toBe(true);
  });

  it('accepts member', () => {
    expect(changeRoleSchema.safeParse({ role: 'member' }).success).toBe(true);
  });

  it('rejects invalid role', () => {
    expect(changeRoleSchema.safeParse({ role: 'owner' }).success).toBe(false);
  });
});

describe('updateSettingsSchema', () => {
  it('accepts fully populated settings', () => {
    const result = updateSettingsSchema.safeParse({
      notifications: { emailOnComplete: true, emailOnError: false },
      locale: 'pt-br',
      theme: 'dark',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all optional)', () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(true);
  });

  it('rejects invalid theme', () => {
    const result = updateSettingsSchema.safeParse({ theme: 'neon' });
    expect(result.success).toBe(false);
  });

  it('accepts partial notifications', () => {
    const result = updateSettingsSchema.safeParse({
      notifications: { emailOnError: true },
    });
    expect(result.success).toBe(true);
  });
});
