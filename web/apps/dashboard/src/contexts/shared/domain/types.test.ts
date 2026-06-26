import { describe, expect, it } from 'vitest';
import { buildOnboardingSK, buildPK, buildTenantSK } from './types';

describe('Shared Domain Key Builders', () => {
  it('buildPK creates tenant-scoped PK', () => {
    expect(buildPK('t-123')).toBe('TENANT#t-123');
  });

  it('buildTenantSK returns METADATA', () => {
    expect(buildTenantSK()).toBe('METADATA');
  });

  it('buildOnboardingSK returns ONBOARDING', () => {
    expect(buildOnboardingSK()).toBe('ONBOARDING');
  });
});
