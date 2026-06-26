'use client';

import { useAuth } from '@clerk/nextjs';
import type { ReactNode } from 'react';
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
  const { orgRole, isSignedIn } = useAuth();

  if (!isSignedIn) {
    return false;
  }

  const role: 'admin' | 'member' = orgRole === 'org:admin' ? 'admin' : 'member';
  return hasPermission(role, permission);
}

/**
 * Returns the current user's role, or null if not authenticated.
 */
export function useRole(): 'admin' | 'member' | null {
  const { orgRole, isSignedIn } = useAuth();

  if (!isSignedIn) {
    return null;
  }

  return orgRole === 'org:admin' ? 'admin' : 'member';
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
