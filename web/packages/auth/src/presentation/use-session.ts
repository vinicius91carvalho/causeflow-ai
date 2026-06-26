'use client';

import { useSession as useNextAuthSession } from 'next-auth/react';
import type { AuthState } from '../domain/types';

/**
 * Typed wrapper around next-auth's useSession hook.
 * Returns a discriminated union for exhaustive handling.
 */
export function useAuthSession(): AuthState {
  const { data, status } = useNextAuthSession();

  if (status === 'loading') {
    return { status: 'loading' };
  }

  if (status === 'authenticated' && data) {
    return {
      status: 'authenticated',
      session: {
        expires: data.expires,
        user: {
          id: (data.user as { id?: string }).id ?? '',
          email: data.user?.email ?? '',
          name: data.user?.name ?? null,
          image: data.user?.image ?? null,
          tenantId: (data.user as { tenantId?: string | null }).tenantId ?? null,
          role: (data.user as { role?: 'admin' | 'member' }).role ?? 'member',
          profileComplete: (data.user as { profileComplete?: boolean }).profileComplete ?? false,
        },
      },
    };
  }

  return { status: 'unauthenticated' };
}

// Re-export for convenience
export { useNextAuthSession as useSession };
