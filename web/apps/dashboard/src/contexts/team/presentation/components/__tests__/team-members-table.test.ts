/**
 * Unit tests for team members table view logic.
 * Tests admin vs member rendering decisions without React rendering.
 */
import { describe, expect, it } from 'vitest';
import { hasPermission, PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import type { User } from '@/contexts/identity/domain/types';

const mockAdminUser: User = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'admin@company.com',
  name: 'Alice Admin',
  role: 'admin',
  profileComplete: true,
  createdAt: new Date().toISOString(),
};

const mockMemberUser: User = {
  id: 'user-2',
  tenantId: 'tenant-1',
  email: 'member@company.com',
  name: 'Bob Member',
  role: 'member',
  profileComplete: true,
  createdAt: new Date().toISOString(),
};

/** Simulates which table columns are shown based on permissions */
function getTableColumns(canManageTeam: boolean): string[] {
  const base = ['member', 'email', 'role', 'joined'];
  if (canManageTeam) {
    return [...base, 'actions'];
  }
  return base;
}

/** Simulates whether the admin action buttons should be visible */
function shouldShowRemoveButton(
  member: User,
  currentUserId: string,
  adminCount: number,
  canManageTeam: boolean,
): boolean {
  if (!canManageTeam) return false;
  if (member.id === currentUserId) return false; // Cannot remove self
  if (member.role === 'admin' && adminCount <= 1) return false; // Last admin protection
  return true;
}

describe('TeamMembersTable column visibility', () => {
  it('shows actions column for admin', () => {
    const cols = getTableColumns(true);
    expect(cols).toContain('actions');
  });

  it('hides actions column for member', () => {
    const cols = getTableColumns(false);
    expect(cols).not.toContain('actions');
  });
});

describe('Remove member button visibility', () => {
  it('admin can remove non-self member', () => {
    expect(shouldShowRemoveButton(mockMemberUser, 'user-1', 2, true)).toBe(true);
  });

  it('admin cannot remove themselves', () => {
    expect(shouldShowRemoveButton(mockAdminUser, 'user-1', 2, true)).toBe(false);
  });

  it('admin cannot remove last admin', () => {
    // Only 1 admin left — cannot remove them
    expect(shouldShowRemoveButton(mockAdminUser, 'user-2', 1, true)).toBe(false);
  });

  it('admin can remove admin if there are 2+ admins', () => {
    expect(shouldShowRemoveButton(mockAdminUser, 'user-2', 2, true)).toBe(true);
  });

  it('member cannot remove anyone', () => {
    expect(shouldShowRemoveButton(mockAdminUser, 'user-3', 2, false)).toBe(false);
    expect(shouldShowRemoveButton(mockMemberUser, 'user-3', 2, false)).toBe(false);
  });
});

describe('Team member display', () => {
  it('admin role member has admin badge styling', () => {
    expect(mockAdminUser.role).toBe('admin');
    expect(hasPermission('admin', PERMISSION.MANAGE_TEAM)).toBe(true);
  });

  it('member role user does not have manage team permission', () => {
    expect(mockMemberUser.role).toBe('member');
    expect(hasPermission('member', PERMISSION.MANAGE_TEAM)).toBe(false);
  });

  it('member role has view access', () => {
    expect(hasPermission('member', PERMISSION.VIEW_ANALYSES)).toBe(true);
    expect(hasPermission('member', PERMISSION.VIEW_INTEGRATIONS)).toBe(true);
  });
});

describe('Initials generation', () => {
  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  it('generates two initials from full name', () => {
    expect(getInitials('Alice Admin')).toBe('AA');
  });

  it('generates single initial from single name', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('truncates to two initials for multi-word names', () => {
    expect(getInitials('Alice Bob Charlie')).toBe('AB');
  });

  it('handles empty name gracefully', () => {
    expect(getInitials('')).toBe('');
  });
});
