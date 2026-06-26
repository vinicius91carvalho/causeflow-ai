'use client';

import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';

interface AuthProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

/**
 * AuthProvider wraps the next-auth SessionProvider.
 * Add this to the root layout of the dashboard app.
 */
export function AuthProvider({ children, session }: AuthProviderProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
