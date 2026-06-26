import { describe, expect, it, vi } from 'vitest';
import { getAvatarColor, getUserInitials } from '../infrastructure/auth-utils';

// Mock next/navigation for redirect tests
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

describe('getUserInitials', () => {
  it('returns "U" for null name', () => {
    expect(getUserInitials(null)).toBe('U');
  });

  it('returns "U" for undefined name', () => {
    expect(getUserInitials(undefined)).toBe('U');
  });

  it('returns "U" for empty string', () => {
    expect(getUserInitials('')).toBe('U');
  });

  it('returns first letter uppercased for single word', () => {
    expect(getUserInitials('alice')).toBe('A');
  });

  it('returns first and last initials for two-word name', () => {
    expect(getUserInitials('Jane Smith')).toBe('JS');
  });

  it('returns first and last initials for multi-word name', () => {
    expect(getUserInitials('Jane Marie Smith')).toBe('JS');
  });

  it('trims leading/trailing whitespace', () => {
    expect(getUserInitials('  Jane Smith  ')).toBe('JS');
  });
});

describe('getAvatarColor', () => {
  it('returns a Tailwind bg-* class', () => {
    const color = getAvatarColor('user-123');
    expect(color).toMatch(/^bg-[a-z]+-500$/);
  });

  it('returns consistent color for the same userId', () => {
    const id = 'consistent-user-id';
    expect(getAvatarColor(id)).toBe(getAvatarColor(id));
  });

  it('returns a color from the predefined palette', () => {
    const validColors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-red-500',
      'bg-teal-500',
      'bg-indigo-500',
      'bg-pink-500',
    ];
    const color = getAvatarColor('test-user');
    expect(validColors).toContain(color);
  });
});

describe('requireAuth', () => {
  it('throws redirect when session is null', async () => {
    const { redirect } = await import('next/navigation');
    const { requireAuth } = await import('../infrastructure/auth-utils');

    expect(() => requireAuth(null)).toThrow('NEXT_REDIRECT:/auth/sign-in');
    expect(redirect).toHaveBeenCalledWith('/auth/sign-in');
  });

  it('returns session when session is valid', async () => {
    const { requireAuth } = await import('../infrastructure/auth-utils');
    const mockSession = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        tenantId: 'tenant-1',
        role: 'member' as const,
        profileComplete: true,
      },
      expires: '2026-12-31T00:00:00.000Z',
    };

    expect(requireAuth(mockSession)).toBe(mockSession);
  });
});

describe('requireRole', () => {
  it('throws redirect when session is null', async () => {
    const { requireRole } = await import('../infrastructure/auth-utils');
    expect(() => requireRole(null, 'admin')).toThrow('NEXT_REDIRECT:/auth/sign-in');
  });

  it('throws redirect when role does not match', async () => {
    const { redirect } = await import('next/navigation');
    const { requireRole } = await import('../infrastructure/auth-utils');
    const mockSession = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        tenantId: 'tenant-1',
        role: 'member' as const,
        profileComplete: true,
      },
      expires: '2026-12-31T00:00:00.000Z',
    };

    expect(() => requireRole(mockSession, 'admin')).toThrow('NEXT_REDIRECT:/dashboard');
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('returns session when role matches', async () => {
    const { requireRole } = await import('../infrastructure/auth-utils');
    const mockSession = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Admin User',
        image: null,
        tenantId: 'tenant-1',
        role: 'admin' as const,
        profileComplete: true,
      },
      expires: '2026-12-31T00:00:00.000Z',
    };

    expect(requireRole(mockSession, 'admin')).toBe(mockSession);
  });
});
