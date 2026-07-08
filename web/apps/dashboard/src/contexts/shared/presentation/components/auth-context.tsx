'use client';

/**
 * Open-source local-runtime auth context (AC-046).
 *
 * Replaces Clerk's `useAuth()` / `useUser()` hooks. Auth info is loaded from
 * a `<script id="__CAUSEFLOW_AUTH__" type="application/json">` tag that server
 * components inject on every authenticated page render. This avoids an
 * additional round-trip to resolve the session.
 *
 * Components that need auth info must be wrapped in `<AuthProvider>` (already
 * done in the root layout).
 */

import { createContext, useContext, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types  (mirrors the core AuthContext shape from with-auth.ts)
// ---------------------------------------------------------------------------

export interface ClientAuthState {
  userId: string | null;
  tenantId: string | null;
  email: string | null;
  name: string | null;
  role: 'admin' | 'member' | null;
  isSignedIn: boolean;
  /** True when the authenticated email ends with a staff domain. */
  isStaff: boolean;
}

// ---------------------------------------------------------------------------
// Default/loading state
// ---------------------------------------------------------------------------

const DEFAULT_AUTH: ClientAuthState = {
  userId: null,
  tenantId: null,
  email: null,
  name: null,
  role: null,
  isSignedIn: false,
  isStaff: false,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<ClientAuthState>(DEFAULT_AUTH);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: React.ReactNode;
  /** Serialised auth state from the server. Pass `null` on public pages. */
  authState: ClientAuthState | null;
}

/**
 * Provides auth context to the React tree.
 *
 * The server layout injects auth state via a `<AuthProvider authState={...} />`
 * after decoding the `__session` JWT cookie. Public pages (sign-in, sign-up)
 * should pass `authState={null}`, which yields the default (unauthenticated)
 * state.
 */
export function AuthProvider({ children, authState }: AuthProviderProps) {
  const value = useMemo(() => authState ?? DEFAULT_AUTH, [authState]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the current auth state: userId, tenantId, role, isSignedIn.
 * Mirrors Clerk's `useAuth()` return shape.
 */
export function useAuth(): {
  userId: string | null;
  tenantId: string | null;
  role: 'admin' | 'member' | null;
  isSignedIn: boolean;
} {
  const ctx = useContext(AuthContext);
  return {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    role: ctx.role,
    isSignedIn: ctx.isSignedIn,
  };
}

/**
 * Returns the current user's profile info.
 * Mirrors Clerk's `useUser()` return shape (subset).
 */
export function useUser(): {
  isLoaded: boolean;
  user: {
    id: string | null;
    fullName: string | null;
    emailAddress: string | null;
    primaryEmailAddress?: { emailAddress: string | null };
    imageUrl: string | null;
  } | null;
} {
  const ctx = useContext(AuthContext);

  const user = useMemo(() => {
    if (!ctx.isSignedIn) return null;
    return {
      id: ctx.userId,
      fullName: ctx.name,
      emailAddress: ctx.email,
      primaryEmailAddress: ctx.email ? { emailAddress: ctx.email } : undefined,
      imageUrl: null, // No avatar storage in the OSS build
    };
  }, [ctx]);

  return {
    isLoaded: true,
    user,
  };
}
