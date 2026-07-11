import { describe, expect, it } from 'vitest';
import { claimsToAuthContext, resolveTenantRole, type SessionClaims } from './session-auth';

describe('resolveTenantRole', () => {
  it('honors scalar role', () => {
    expect(resolveTenantRole({ role: 'admin' })).toBe('admin');
    expect(resolveTenantRole({ role: 'member' })).toBe('member');
  });

  it('honors orgRole when role is absent', () => {
    expect(resolveTenantRole({ orgRole: 'admin' })).toBe('admin');
  });

  it('honors roles array when scalar role is absent (OSS Core JWT)', () => {
    const claims: SessionClaims = { roles: ['admin'] };
    expect(resolveTenantRole(claims)).toBe('admin');
    expect(claimsToAuthContext(claims).role).toBe('admin');
  });

  it('defaults to member when no role claims are present', () => {
    expect(resolveTenantRole({})).toBe('member');
  });
});
