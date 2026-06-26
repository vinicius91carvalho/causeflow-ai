'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthSession } from './use-session';

interface AuthGuardProps {
  children: React.ReactNode;
  /** Optional fallback shown while loading the session */
  fallback?: React.ReactNode;
  /** Redirect path when unauthenticated (default: '/auth/sign-in') */
  redirectTo?: string;
}

/**
 * AuthGuard — client-side component that protects its children.
 * Redirects to the sign-in page if the session is not authenticated.
 *
 * Prefer server-side `requireAuth()` in Server Components.
 * Use this only in client-only contexts.
 */
export function AuthGuard({
  children,
  fallback = null,
  redirectTo = '/auth/sign-in',
}: AuthGuardProps) {
  const router = useRouter();
  const auth = useAuthSession();

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      router.replace(redirectTo);
    }
  }, [auth.status, router, redirectTo]);

  if (auth.status === 'loading') {
    return <>{fallback}</>;
  }

  if (auth.status === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}

/**
 * withAuth — Higher-order component version of AuthGuard.
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<AuthGuardProps, 'children'>,
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <AuthGuard {...options}>
      <Component {...props} />
    </AuthGuard>
  );
  WrappedComponent.displayName = `withAuth(${Component.displayName ?? Component.name})`;
  return WrappedComponent;
}
