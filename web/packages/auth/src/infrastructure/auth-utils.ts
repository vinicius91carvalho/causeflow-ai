import { redirect } from 'next/navigation';
import type { Session, UserRole } from '../domain/types';

/**
 * Type guard for a complete CauseFlow session with extended user fields.
 */
export function isValidSession(session: unknown): session is Session {
  if (!session || typeof session !== 'object') return false;
  const s = session as Record<string, unknown>;
  if (!s.user || typeof s.user !== 'object') return false;
  return true;
}

/**
 * requireAuth — use in Server Components to ensure the user is logged in.
 * Redirects to /auth/sign-in if not authenticated.
 *
 * Usage (in a Server Component):
 *   import { getServerSession } from 'next-auth';
 *   import { authConfig } from '@causeflow/auth/config';
 *   import { requireAuth } from '@causeflow/auth';
 *
 *   const session = await getServerSession(authConfig);
 *   const validSession = requireAuth(session);
 */
export function requireAuth(session: Session | null): Session {
  if (!session) {
    redirect('/auth/sign-in');
  }
  return session;
}

/**
 * requireRole — use in Server Components/actions to enforce role-based access.
 * Redirects to /dashboard if the user lacks the required role.
 */
export function requireRole(session: Session | null, role: UserRole): Session {
  const validSession = requireAuth(session);
  if (validSession.user.role !== role) {
    redirect('/dashboard');
  }
  return validSession;
}

/**
 * Helper to get user initials for the avatar fallback.
 */
export function getUserInitials(name: string | null | undefined): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

/**
 * Returns a consistent avatar color based on user ID.
 */
export function getAvatarColor(userId: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
}
