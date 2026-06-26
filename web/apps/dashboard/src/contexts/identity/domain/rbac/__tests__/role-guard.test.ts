/**
 * Unit tests for RoleGuard logic (usePermission / useRole).
 * Tests the pure permission-checking logic without rendering React components.
 */

import type { UserRole } from '@causeflow/auth/types';
import { describe, expect, it } from 'vitest';
import type { Permission } from '../permissions';
import { hasPermission, PERMISSION } from '../permissions';

/**
 * Simulates what usePermission hook returns for a given auth state.
 * This mirrors the hook logic without the React layer.
 */
function simulateUsePermission(
  authStatus: 'loading' | 'authenticated' | 'unauthenticated',
  role: UserRole | null,
  permission: Permission,
): boolean {
  if (authStatus !== 'authenticated' || role === null) {
    return false;
  }
  return hasPermission(role, permission);
}

describe('usePermission (logic)', () => {
  describe('when loading', () => {
    it('returns false for any permission', () => {
      expect(simulateUsePermission('loading', null, PERMISSION.MANAGE_TEAM)).toBe(false);
      expect(simulateUsePermission('loading', null, PERMISSION.VIEW_ANALYSES)).toBe(false);
    });
  });

  describe('when unauthenticated', () => {
    it('returns false for any permission', () => {
      expect(simulateUsePermission('unauthenticated', null, PERMISSION.MANAGE_TEAM)).toBe(false);
      expect(simulateUsePermission('unauthenticated', null, PERMISSION.SUBMIT_ANALYSIS)).toBe(
        false,
      );
    });
  });

  describe('when authenticated as admin', () => {
    it('returns true for MANAGE_TEAM', () => {
      expect(simulateUsePermission('authenticated', 'admin', PERMISSION.MANAGE_TEAM)).toBe(true);
    });

    it('returns true for MANAGE_INTEGRATIONS', () => {
      expect(simulateUsePermission('authenticated', 'admin', PERMISSION.MANAGE_INTEGRATIONS)).toBe(
        true,
      );
    });

    it('returns true for SUBMIT_ANALYSIS', () => {
      expect(simulateUsePermission('authenticated', 'admin', PERMISSION.SUBMIT_ANALYSIS)).toBe(
        true,
      );
    });
  });

  describe('when authenticated as member', () => {
    it('returns false for MANAGE_TEAM', () => {
      expect(simulateUsePermission('authenticated', 'member', PERMISSION.MANAGE_TEAM)).toBe(false);
    });

    it('returns false for MANAGE_INTEGRATIONS', () => {
      expect(simulateUsePermission('authenticated', 'member', PERMISSION.MANAGE_INTEGRATIONS)).toBe(
        false,
      );
    });

    it('returns true for SUBMIT_ANALYSIS', () => {
      expect(simulateUsePermission('authenticated', 'member', PERMISSION.SUBMIT_ANALYSIS)).toBe(
        true,
      );
    });

    it('returns true for VIEW_ANALYSES', () => {
      expect(simulateUsePermission('authenticated', 'member', PERMISSION.VIEW_ANALYSES)).toBe(true);
    });

    it('returns true for VIEW_INTEGRATIONS', () => {
      expect(simulateUsePermission('authenticated', 'member', PERMISSION.VIEW_INTEGRATIONS)).toBe(
        true,
      );
    });
  });
});

describe('RoleGuard rendering logic', () => {
  /**
   * Simulates what RoleGuard component would render:
   * - allowed: render children
   * - not allowed: render fallback (or null)
   */
  function simulateRoleGuard(
    role: UserRole | null,
    permission: Permission,
  ): 'children' | 'fallback' {
    const allowed = role !== null && hasPermission(role, permission);
    return allowed ? 'children' : 'fallback';
  }

  it('renders children for admin with manage_team permission', () => {
    expect(simulateRoleGuard('admin', PERMISSION.MANAGE_TEAM)).toBe('children');
  });

  it('renders fallback for member with manage_team permission', () => {
    expect(simulateRoleGuard('member', PERMISSION.MANAGE_TEAM)).toBe('fallback');
  });

  it('renders children for member with submit_analysis permission', () => {
    expect(simulateRoleGuard('member', PERMISSION.SUBMIT_ANALYSIS)).toBe('children');
  });

  it('renders fallback when role is null (unauthenticated)', () => {
    expect(simulateRoleGuard(null, PERMISSION.VIEW_ANALYSES)).toBe('fallback');
  });

  it('renders children for admin with all permissions', () => {
    const allPermissions = Object.values(PERMISSION);
    for (const perm of allPermissions) {
      expect(simulateRoleGuard('admin', perm)).toBe('children');
    }
  });
});
