import { describe, expect, it } from 'vitest';
import { getPermissions, hasPermission, PERMISSION, requirePermission } from '../permissions';

describe('hasPermission', () => {
  describe('admin role', () => {
    it('has MANAGE_TEAM permission', () => {
      expect(hasPermission('admin', PERMISSION.MANAGE_TEAM)).toBe(true);
    });

    it('has MANAGE_INTEGRATIONS permission', () => {
      expect(hasPermission('admin', PERMISSION.MANAGE_INTEGRATIONS)).toBe(true);
    });

    it('has MANAGE_BILLING permission', () => {
      expect(hasPermission('admin', PERMISSION.MANAGE_BILLING)).toBe(true);
    });

    it('has SUBMIT_ANALYSIS permission', () => {
      expect(hasPermission('admin', PERMISSION.SUBMIT_ANALYSIS)).toBe(true);
    });

    it('has VIEW_ANALYSES permission', () => {
      expect(hasPermission('admin', PERMISSION.VIEW_ANALYSES)).toBe(true);
    });

    it('has VIEW_INTEGRATIONS permission', () => {
      expect(hasPermission('admin', PERMISSION.VIEW_INTEGRATIONS)).toBe(true);
    });

    it('has MANAGE_SETTINGS permission', () => {
      expect(hasPermission('admin', PERMISSION.MANAGE_SETTINGS)).toBe(true);
    });

    it('has VIEW_BILLING permission', () => {
      expect(hasPermission('admin', PERMISSION.VIEW_BILLING)).toBe(true);
    });

    it('has VIEW_SETTINGS permission', () => {
      expect(hasPermission('admin', PERMISSION.VIEW_SETTINGS)).toBe(true);
    });

    it('has VIEW_TEAM permission', () => {
      expect(hasPermission('admin', PERMISSION.VIEW_TEAM)).toBe(true);
    });
  });

  describe('member role', () => {
    it('does NOT have MANAGE_TEAM permission', () => {
      expect(hasPermission('member', PERMISSION.MANAGE_TEAM)).toBe(false);
    });

    it('does NOT have MANAGE_INTEGRATIONS permission', () => {
      expect(hasPermission('member', PERMISSION.MANAGE_INTEGRATIONS)).toBe(false);
    });

    it('does NOT have MANAGE_BILLING permission', () => {
      expect(hasPermission('member', PERMISSION.MANAGE_BILLING)).toBe(false);
    });

    it('has SUBMIT_ANALYSIS permission', () => {
      expect(hasPermission('member', PERMISSION.SUBMIT_ANALYSIS)).toBe(true);
    });

    it('has VIEW_ANALYSES permission', () => {
      expect(hasPermission('member', PERMISSION.VIEW_ANALYSES)).toBe(true);
    });

    it('has VIEW_INTEGRATIONS permission (read-only)', () => {
      expect(hasPermission('member', PERMISSION.VIEW_INTEGRATIONS)).toBe(true);
    });

    it('does NOT have MANAGE_SETTINGS permission', () => {
      expect(hasPermission('member', PERMISSION.MANAGE_SETTINGS)).toBe(false);
    });

    it('has VIEW_BILLING permission (read-only)', () => {
      expect(hasPermission('member', PERMISSION.VIEW_BILLING)).toBe(true);
    });

    it('has VIEW_SETTINGS permission (read-only)', () => {
      expect(hasPermission('member', PERMISSION.VIEW_SETTINGS)).toBe(true);
    });

    it('has VIEW_TEAM permission (read-only)', () => {
      expect(hasPermission('member', PERMISSION.VIEW_TEAM)).toBe(true);
    });
  });
});

describe('requirePermission', () => {
  it('does not throw when permission is granted', () => {
    expect(() => requirePermission('admin', PERMISSION.MANAGE_TEAM)).not.toThrow();
  });

  it('throws when permission is denied', () => {
    expect(() => requirePermission('member', PERMISSION.MANAGE_TEAM)).toThrow(/Permission denied/);
  });

  it('error message includes the role and permission', () => {
    let message = '';
    try {
      requirePermission('member', PERMISSION.MANAGE_INTEGRATIONS);
    } catch (err: unknown) {
      message = err instanceof Error ? err.message : '';
    }
    expect(message).toContain('member');
    expect(message).toContain(PERMISSION.MANAGE_INTEGRATIONS);
  });
});

describe('getPermissions', () => {
  it('returns all 10 permissions for admin', () => {
    expect(getPermissions('admin').length).toBe(10);
  });

  it('returns 6 permissions for member (4 VIEW_* + SUBMIT_ANALYSIS + VIEW_ANALYSES)', () => {
    expect(getPermissions('member').length).toBe(6);
  });

  it('member has all four VIEW_* permissions', () => {
    const memberPerms = new Set(getPermissions('member'));
    expect(memberPerms.has(PERMISSION.VIEW_INTEGRATIONS)).toBe(true);
    expect(memberPerms.has(PERMISSION.VIEW_BILLING)).toBe(true);
    expect(memberPerms.has(PERMISSION.VIEW_SETTINGS)).toBe(true);
    expect(memberPerms.has(PERMISSION.VIEW_TEAM)).toBe(true);
  });

  it('member has zero MANAGE_* permissions', () => {
    const memberPerms = new Set(getPermissions('member'));
    expect(memberPerms.has(PERMISSION.MANAGE_TEAM)).toBe(false);
    expect(memberPerms.has(PERMISSION.MANAGE_INTEGRATIONS)).toBe(false);
    expect(memberPerms.has(PERMISSION.MANAGE_BILLING)).toBe(false);
    expect(memberPerms.has(PERMISSION.MANAGE_SETTINGS)).toBe(false);
  });

  it('member permissions are a subset of admin permissions', () => {
    const adminPerms = new Set(getPermissions('admin'));
    const memberPerms = getPermissions('member');
    for (const perm of memberPerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });
});
