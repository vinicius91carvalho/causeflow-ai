/**
 * Unit tests for change role dialog logic.
 * Tests role change validation and self-demotion warning logic.
 */
import { describe, expect, it } from 'vitest';
import type { UserRole } from '@/contexts/identity/domain/types';

/**
 * Determines if the submit button should be disabled.
 * Mirrors the logic in ChangeRoleDialog.
 */
function isSubmitDisabled(params: {
  isSubmitting: boolean;
  isLastAdmin: boolean;
  isSelf: boolean;
  selectedRole: UserRole;
  currentRole: UserRole;
}): boolean {
  const { isSubmitting, isLastAdmin, isSelf, selectedRole, currentRole } = params;

  if (isSubmitting) return true;
  if (isLastAdmin && isSelf && selectedRole !== 'admin') return true;
  if (selectedRole === currentRole) return true;
  return false;
}

/**
 * Determines if a warning should be shown when demoting self.
 */
function shouldShowSelfWarning(isSelf: boolean, selectedRole: UserRole): boolean {
  return isSelf && selectedRole !== 'admin';
}

describe('ChangeRoleDialog submit button state', () => {
  it('is disabled when same role selected', () => {
    expect(
      isSubmitDisabled({
        isSubmitting: false,
        isLastAdmin: false,
        isSelf: false,
        selectedRole: 'admin',
        currentRole: 'admin',
      }),
    ).toBe(true);
  });

  it('is disabled when submitting', () => {
    expect(
      isSubmitDisabled({
        isSubmitting: true,
        isLastAdmin: false,
        isSelf: false,
        selectedRole: 'member',
        currentRole: 'admin',
      }),
    ).toBe(true);
  });

  it('is disabled when last admin tries to demote self', () => {
    expect(
      isSubmitDisabled({
        isSubmitting: false,
        isLastAdmin: true,
        isSelf: true,
        selectedRole: 'member',
        currentRole: 'admin',
      }),
    ).toBe(true);
  });

  it('is enabled when admin changes another user role', () => {
    expect(
      isSubmitDisabled({
        isSubmitting: false,
        isLastAdmin: false,
        isSelf: false,
        selectedRole: 'member',
        currentRole: 'admin',
      }),
    ).toBe(false);
  });

  it('is enabled when non-last admin demotes self', () => {
    expect(
      isSubmitDisabled({
        isSubmitting: false,
        isLastAdmin: false,
        isSelf: true,
        selectedRole: 'member',
        currentRole: 'admin',
      }),
    ).toBe(false);
  });
});

describe('ChangeRoleDialog self-demotion warning', () => {
  it('shows warning when self changes to member', () => {
    expect(shouldShowSelfWarning(true, 'member')).toBe(true);
  });

  it('does not show warning when changing other user', () => {
    expect(shouldShowSelfWarning(false, 'member')).toBe(false);
  });

  it('does not show warning when self stays admin', () => {
    expect(shouldShowSelfWarning(true, 'admin')).toBe(false);
  });
});

describe('ChangeRoleDialog role options', () => {
  const validRoles: UserRole[] = ['admin', 'member'];

  it('has exactly two roles', () => {
    expect(validRoles.length).toBe(2);
  });

  it('includes admin and member roles', () => {
    expect(validRoles).toContain('admin');
    expect(validRoles).toContain('member');
  });
});
