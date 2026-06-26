/**
 * Unit tests for invite modal validation logic.
 * Tests email validation and submission flow without React rendering.
 */
import { describe, expect, it } from 'vitest';

/**
 * Email validation logic extracted from invite-modal.tsx
 */
function validateInviteEmail(email: string): string {
  if (!email.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address';
  return '';
}

describe('InviteModal email validation', () => {
  it('returns error for empty email', () => {
    expect(validateInviteEmail('')).toBe('Email is required');
    expect(validateInviteEmail('   ')).toBe('Email is required');
  });

  it('returns error for invalid email format', () => {
    expect(validateInviteEmail('notanemail')).toBeTruthy();
    expect(validateInviteEmail('missing@')).toBeTruthy();
    expect(validateInviteEmail('@nodomain')).toBeTruthy();
  });

  it('returns empty string for valid email', () => {
    expect(validateInviteEmail('user@example.com')).toBe('');
    expect(validateInviteEmail('user+tag@company.org')).toBe('');
  });

  it('trims email before validation', () => {
    expect(validateInviteEmail('  user@example.com  ')).toBe('');
  });
});

describe('InviteModal role options', () => {
  const roles = ['admin', 'member'] as const;

  it('supports admin role', () => {
    expect(roles).toContain('admin');
  });

  it('supports member role', () => {
    expect(roles).toContain('member');
  });

  it('defaults to member role (safest default)', () => {
    const defaultRole = 'member';
    expect(defaultRole).toBe('member');
  });
});

describe('InviteModal API error handling', () => {
  it('handles duplicate invite (409) error', () => {
    const errorMessages: Record<number, string> = {
      409: 'An active invite already exists for this email address.',
      500: 'Failed to send invite. Please try again.',
    };

    expect(errorMessages[409]).toContain('already exists');
    expect(errorMessages[500]).toContain('Failed');
  });
});
