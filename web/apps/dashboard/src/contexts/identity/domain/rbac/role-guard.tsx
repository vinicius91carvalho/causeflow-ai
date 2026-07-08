'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/shared/presentation/components/auth-context';
import type { Permission } from './permissions';
import { hasPermission } from './permissions';

// ---------------------------------------------------------------------------
// usePermission hook
// ---------------------------------------------------------------------------

/**
 * Returns whether the current user has the specified permission.
 * Returns false while loading or unauthenticated.
 */
export function usePermission(permission: Permission): boolean {
  const { role, isSignedIn } = useAuth();

  if (!isSignedIn) {
    return false;
  }

  return hasPermission(role ?? 'member', permission);
}

/**
 * Returns the current user's role, or null if not authenticated.
 */
export function useRole(): 'admin' | 'member' | null {
  const { role, isSignedIn } = useAuth();

  if (!isSignedIn) {
    return null;
  }

  return role;
}

// ---------------------------------------------------------------------------
// RoleGuard component
// ---------------------------------------------------------------------------

interface RoleGuardProps {
  /** The permission to check. If the user lacks it, children are hidden. */
  permission: Permission;
  /** What to render when the user lacks the permission (optional). */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Client component that conditionally renders children based on the user's
 * RBAC permissions. Renders nothing (or `fallback`) if permission is absent.
 *
 * Example:
 * ```tsx
 * <RoleGuard permission={PERMISSION.MANAGE_TEAM}>
 *   <InviteMemberButton />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({ permission, fallback = null, children }: RoleGuardProps) {
  const allowed = usePermission(permission);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
